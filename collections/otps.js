const connectDB = require("../config/db");
const {
    OTP_EXPIRY_SECONDS,
} = require("../utils/otpConfig");

// Save OTP
async function saveOTP(email, otp, expiresAt) {
    try {
        const db = await connectDB();

        return await db.collection("otps").insertOne({
            email,
            otp,

            status: "sent",

            attemptCount: 0,
            resendCount: 0,

            createdAt: new Date(),

            expiresAt:
                expiresAt ||
                new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000),

            verifiedAt: null,
        });

    } catch (error) {
        console.error("Error saving OTP:", error);

        throw error;
    }
}


// Find Valid OTP
async function findOTP(email, otp) {
    try {
        const db = await connectDB();

        return await db.collection("otps").findOne({
            email,
            otp,
            status: "sent",
            expiresAt: {
                $gt: new Date(),
            },
        });

    } catch (error) {
        console.error("Error finding OTP:", error);
        throw error;
    }
}


// Find Latest OTP
async function findLatestOTP(email) {
    try {
        const db = await connectDB();

        return await db.collection("otps").findOne(
            { email },
            {
                sort: {
                    createdAt: -1,
                },
            }
        );

    } catch (error) {
        console.error("Error finding latest OTP:", error);

        throw error;
    }
}

// Find Active OTP
async function findActiveOTP(email) {
    try {
        const db = await connectDB();

        return await db.collection("otps").findOne({
            email,
            status: "sent",
            expiresAt: {
                $gt: new Date(),
            },
        });

    } catch (error) {
        console.error("Error finding active OTP:", error);

        throw error;
    }
}


// Mark OTP Verified
async function markOTPAsVerified(otpId) {
    try {
        const db = await connectDB();

        return await db.collection("otps").updateOne(
            { _id: otpId },
            {
                $set: {
                    status: "verified",

                    verifiedAt: new Date(),
                },
            }
        );

    } catch (error) {
        console.error("Error updating OTP:", error);

        throw error;
    }
}


// Increment Wrong OTP Attempt Count
async function incrementAttemptCount(otpId) {
    try {
        const db = await connectDB();

        return await db.collection("otps").updateOne(
            { _id: otpId },
            {
                $inc: {
                    attemptCount: 1,
                },
            }
        );

    } catch (error) {
        console.error(
            "Error incrementing attempt count:",
            error
        );

        throw error;
    }
}


// Block OTP After Too Many Failed Attempts
async function blockOTP(otpId) {
    try {
        const db = await connectDB();

        return await db.collection("otps").updateOne(
            { _id: otpId },
            {
                $set: {
                    status: "blocked",
                },
            }
        );

    } catch (error) {
        console.error(
            "Error blocking OTP:",
            error
        );

        throw error;
    }
}

module.exports = {
    saveOTP,
    findOTP,
    findLatestOTP,
    markOTPAsVerified,
    findActiveOTP,
    incrementAttemptCount,
    blockOTP,

};
