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

// AUTH PAGE
async function showAuthPage(req, res) {
    try {
        // Change Email Request
        if (req.query.action === "changeEmail") {
            delete req.session.email;
            delete req.session.otpSentAt;

            return res.redirect("/");
        }

        // Already Logged In
        if (req.session.userId) {
            return res.redirect("/dashboard");
        }

        return res.render("auth/login", {
            otpSent: !!req.session.email,
            email: req.session.email || "",
            otpSentAt: req.session.otpSentAt || null,
            otpExpirySeconds: OTP_EXPIRY_SECONDS,
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
            req.flash(
                "error_msg",
                `OTP already sent. Please wait ${remainingSeconds}s before requesting a new one.`
            );

            return res.redirect("/");
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

        req.flash(
            "success_msg",
            isResend
                ? "OTP resent successfully"
                : "OTP sent successfully"
        );

        return res.redirect("/");

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

        // Validate OTP Format
        if (!/^\d{6}$/.test(otp)) {
            req.flash("error_msg", "Invalid OTP");
            return res.redirect("/");
        }

        const email = req.session.email;

        // OTP Session Exists?
        if (!email) {
            req.flash("error_msg", "Please request an OTP first");
            return res.redirect("/");
        }

        // Find Latest OTP
        const latestOTP = await findLatestOTP(email);

        // OTP Blocked
        if (latestOTP && latestOTP.status === "blocked") {
            req.flash(
                "error_msg",
                "Too many failed attempts. Please request a new OTP."
            );
            return res.redirect("/");
        }

        const otpRecord = await findOTP(email, otp);
        const activeOTP = await findActiveOTP(email);

        // Invalid OTP
        if (!otpRecord) {
            if (
                latestOTP &&
                latestOTP.otp === otp &&
                latestOTP.status === "sent" &&
                latestOTP.expiresAt < new Date()
            ) {
                delete req.session.email;
                delete req.session.otpSentAt;

                req.flash("error_msg", "OTP Expired");
                return res.redirect("/");
            }

            if (activeOTP) {
                await incrementAttemptCount(activeOTP._id);

                if (activeOTP.attemptCount + 1 >= 5) {
                    await blockOTP(activeOTP._id);

                    req.flash(
                        "error_msg",
                        "Too many failed attempts. Please request a new OTP."
                    );

                    return res.redirect("/");
                }
            }

            req.flash("error_msg", "Invalid OTP");
            return res.redirect("/");
        }

        // OTP Expired
        if (otpRecord.expiresAt < new Date()) {
            delete req.session.email;
            delete req.session.otpSentAt;

            req.flash("error_msg", "OTP Expired");
            return res.redirect("/");
        }

        const user = await findOrCreateUserByEmail(email);

        // Mark OTP As Verified
        await markOTPAsVerified(otpRecord._id);

        // Mark Email Lead As Verified
        await markEmailAsVerified(
            email
        );

        // Create Fresh Session
        await new Promise((resolve, reject) => {
            req.session.regenerate((err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        // Login User
        req.session.userId = user._id;
        req.session.userEmail = user.email;

        // Save Session
        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        // Save Login History
        await saveSession({
            sessionId: req.sessionID,
            userId: user._id,
            email: user.email,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });

        req.flash("success_msg", "Logged in successfully");
        return res.redirect("/dashboard");

    } catch (error) {
        console.error("Verify OTP Error:", error);

        req.flash("error_msg", "Server Error");
        return res.redirect("/");
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
