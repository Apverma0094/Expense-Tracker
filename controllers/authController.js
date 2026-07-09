const generateOTP = require("../utils/generateOTP");
const sendOTPEmail = require("../utils/emailService");

const {
    saveOTP,
    findOTP,
    findActiveOTP,
    markOTPAsVerified,
    incrementAttemptCount,
    blockOTP,
    findLatestOTP,
} = require("../collections/otps");

const {
    findOrCreateUserByEmail,
} = require("../collections/users");

const {
    saveSession,
    logoutSession,
} = require("../collections/session");

const {
    saveEmailLead,
    findEmailLead,
    updateLastAttempt,
    markEmailAsVerified,
} = require("../collections/emailLeads");
const {
    OTP_EXPIRY_SECONDS,
} = require("../utils/otpConfig");

function getRemainingCooldownSeconds(otpSentAt, activeOTP) {
    const now = Date.now();
    const sessionRemaining = otpSentAt
        ? Math.ceil(((Number(otpSentAt) + (OTP_EXPIRY_SECONDS * 1000)) - now) / 1000)
        : 0;
    const activeOtpRemaining = activeOTP?.expiresAt
        ? Math.ceil((new Date(activeOTP.expiresAt).getTime() - now) / 1000)
        : 0;

    return Math.max(sessionRemaining, activeOtpRemaining, 0);
}

function saveRequestSession(req) {
    return new Promise((resolve, reject) => {
        req.session.save((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

function renderAuthPage(res, options = {}) {
    const {
        otpSent = false,
        email = "",
        otpSentAt = null,
        successMessage = "",
        errorMessage = "",
    } = options;

    if (successMessage) {
        res.locals.toastMessages = [
            ...(res.locals.toastMessages || []),
            {
                type: "success",
                title: "Success",
                message: successMessage,
            },
        ];
    }

    if (errorMessage) {
        res.locals.toastMessages = [
            ...(res.locals.toastMessages || []),
            {
                type: "error",
                title: "Error",
                message: errorMessage,
            },
        ];
    }

    return res.render("auth/login", {
        otpSent,
        email,
        otpSentAt,
        otpExpirySeconds: OTP_EXPIRY_SECONDS,
    });
}

// AUTH PAGE
async function showAuthPage(req, res) {
    try {
        // Change Email Request
        if (req.query.action === "changeEmail") {
            delete req.session.email;
            delete req.session.otpSentAt;
            await saveRequestSession(req);

            return res.redirect("/");
        }

        // Already Logged In
        if (req.session.userId) {
            return res.redirect("/dashboard");
        }

        return renderAuthPage(res, {
            otpSent: !!req.session.email,
            email: req.session.email || "",
            otpSentAt: req.session.otpSentAt || null,
        });

    } catch (error) {
        console.error(error);

        req.flash("error_msg", "Server Error");

        return res.redirect("/");
    }
}


// AUTH HANDLER
async function authHandler(req, res) {
    try {
        if (req.session.userId) {
            return res.redirect("/dashboard");
        }

        const { action } = req.body;

        switch (action) {
            case "sendOtp":
                return await sendOTP(req, res);

            case "resendOtp":
                return await sendOTP(req, res, { isResend: true });

            case "verifyOtp":
                return await verifyOTP(req, res);

            default:
                return res.redirect("/");
        }

    } catch (error) {
        console.error(error);

        req.flash("error_msg", "Server Error");

        return res.redirect("/");
    }
}


// SEND OTP
async function sendOTP(req, res, options = {}) {
    try {
        const isResend = options.isResend === true;
        let email = isResend
            ? req.session.email
            : req.body.email;

        email = email?.trim().toLowerCase();

        if (!email) {
            req.flash(
                "error_msg",
                isResend
                    ? "Please request an OTP first"
                    : "Email is required"
            );

            return res.redirect("/");
        }

        // Validate Email Format
        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            req.flash(
                "error_msg",
                "Please enter a valid email address"
            );

            return res.redirect("/");
        }

        // Save Or Update Email Lead
        const emailLead =
            await findEmailLead(email);

        if (!emailLead) {

            await saveEmailLead(email);

        } else {

            await updateLastAttempt(email);

        }

        // Check active OTP
        const activeOTP = await findActiveOTP(email);

        const remainingSeconds = getRemainingCooldownSeconds(
            req.session.otpSentAt,
            activeOTP
        );

        if (remainingSeconds > 0) {
            req.session.email = email;
            req.session.otpSentAt = activeOTP?.createdAt
                ? new Date(activeOTP.createdAt).getTime()
                : Date.now();
            await saveRequestSession(req);
            return renderAuthPage(res, {
                otpSent: true,
                email,
                otpSentAt: req.session.otpSentAt,
                errorMessage: `OTP already sent. Please wait ${remainingSeconds}s before requesting a new one.`,
            });
        }

        const { otp, expiresAt } = generateOTP();

        await saveOTP(
            email,
            otp,
            expiresAt
        );

        await sendOTPEmail(
            email,
            otp
        );

        // Temporary OTP Session
        req.session.email = email;
        req.session.otpSentAt = Date.now();
        await saveRequestSession(req);
        return renderAuthPage(res, {
            otpSent: true,
            email,
            otpSentAt: req.session.otpSentAt,
            successMessage: isResend
                ? "OTP resent successfully"
                : "OTP sent successfully",
        });

    } catch (error) {
        console.error(
            "Send OTP Error:",
            error
        );

        req.flash(
            "error_msg",
            "Failed to send OTP"
        );

        return res.redirect("/");
    }
}


// VERIFY OTP
async function verifyOTP(req, res) {
    try {
        const { otp } = req.body;
        const fallbackEmail = String(req.body.email || "").trim().toLowerCase();

        // Validate OTP Format
        if (!/^\d{6}$/.test(otp)) {
            return renderAuthPage(res, {
                otpSent: Boolean(req.session.email || fallbackEmail),
                email: req.session.email || fallbackEmail,
                otpSentAt: req.session.otpSentAt || null,
                errorMessage: "Invalid OTP",
            });
        }

        const email = String(req.session.email || fallbackEmail || "").trim().toLowerCase();

        if (!req.session.email && email) {
            req.session.email = email;
            await saveRequestSession(req);
        }

        // OTP Session Exists?
        if (!email) {
            return renderAuthPage(res, {
                otpSent: false,
                email: "",
                otpSentAt: null,
                errorMessage: "Please request an OTP first",
            });
        }

        // Find Latest OTP
        const latestOTP = await findLatestOTP(email);

        if (!latestOTP) {
            return renderAuthPage(res, {
                otpSent: false,
                email: "",
                otpSentAt: null,
                errorMessage: "Please request an OTP first",
            });
        }

        // OTP Blocked
        if (latestOTP.status === "blocked") {
            return renderAuthPage(res, {
                otpSent: true,
                email,
                otpSentAt: req.session.otpSentAt || null,
                errorMessage: "Too many failed attempts. Please request a new OTP.",
            });
        }

        // OTP Expired
        if (latestOTP.expiresAt < new Date()) {
            delete req.session.email;
            delete req.session.otpSentAt;
            await saveRequestSession(req);
            return renderAuthPage(res, {
                otpSent: false,
                email: "",
                otpSentAt: null,
                errorMessage: "OTP Expired",
            });
        }

        // Invalid OTP
        if (String(latestOTP.otp) !== String(otp)) {
            await incrementAttemptCount(latestOTP._id);

            if (Number(latestOTP.attemptCount || 0) + 1 >= 5) {
                await blockOTP(latestOTP._id);

                return renderAuthPage(res, {
                    otpSent: true,
                    email,
                    otpSentAt: req.session.otpSentAt || null,
                    errorMessage: "Too many failed attempts. Please request a new OTP.",
                });
            }

            return renderAuthPage(res, {
                otpSent: true,
                email,
                otpSentAt: req.session.otpSentAt || null,
                errorMessage: "Invalid OTP",
            });
        }

        const user = await findOrCreateUserByEmail(email);

        // Mark OTP As Verified
        await markOTPAsVerified(latestOTP._id);

        // Mark Email Lead As Verified
        await markEmailAsVerified(
            email
        );

        // Login User
        req.session.userId = String(user._id);
        req.session.userEmail = user.email;
        console.log("LOGIN SESSION:", req.session.userId, req.session.userEmail);
        delete req.session.email;
        delete req.session.otpSentAt;

        // Save Login History
        try {
            await saveSession({
                sessionId: req.sessionID,
                userId: user._id,
                email: user.email,
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"],
            });
        } catch (sessionLogError) {
            console.error("Login history save failed:", sessionLogError);
        }

        req.flash("success_msg", "Logged in successfully");
        await saveRequestSession(req);
        return res.redirect("/dashboard");

    } catch (error) {
        console.error("Verify OTP Error:", error);
        return renderAuthPage(res, {
            otpSent: Boolean(req.session.email),
            email: req.session.email || "",
            otpSentAt: req.session.otpSentAt || null,
            errorMessage: "Server Error",
        });
    }
}


// LOGOUT
async function logout(req, res) {
    try {
        const sessionId = req.sessionID;

        if (sessionId) {
            await logoutSession(sessionId);
        }

        req.session.destroy((error) => {
            if (error) {
                console.error("Session destroy error:", error);

                req.flash("error_msg", "Logout Error");

                return res.redirect("/dashboard");
            }

            res.clearCookie("connect.sid");

            return res.redirect("/");
        });

    } catch (error) {
        console.error("Logout Error:", error);

        req.flash("error_msg", "Server Error");

        return res.redirect("/dashboard");
    }
}


module.exports = {
    showAuthPage,
    authHandler,
    logout,
};
