const connectDB = require("../config/db");


//
// Save New Email Lead
//
async function saveEmailLead(email) {
    try {
        const db = await connectDB();

        return await db.collection("email_leads").insertOne({
            email,

            status: "not_verified",

            firstAttemptAt: new Date(),
            lastAttemptAt: new Date(),

            verifiedAt: null,
        });

    } catch (error) {
        console.error(
            "Error saving email lead:",
            error
        );

        throw error;
    }
}


//
// Find Email Lead
//
async function findEmailLead(email) {
    try {
        const db = await connectDB();

        return await db.collection("email_leads").findOne({
            email,
        });

    } catch (error) {
        console.error(
            "Error finding email lead:",
            error
        );

        throw error;
    }
}


//
// Update Last Attempt Time
//
async function updateLastAttempt(email) {
    try {
        const db = await connectDB();

        return await db.collection("email_leads").updateOne(
            { email },
            {
                $set: {
                    lastAttemptAt: new Date(),
                },
            }
        );

    } catch (error) {
        console.error(
            "Error updating last attempt:",
            error
        );

        throw error;
    }
}


//
// Mark Email As Verified
//
async function markEmailAsVerified(email) {
    try {
        const db = await connectDB();

        return await db.collection("email_leads").updateOne(
            { email },
            {
                $set: {
                    status: "verified",
                    verifiedAt: new Date(),
                },
            }
        );

    } catch (error) {
        console.error(
            "Error marking email verified:",
            error
        );

        throw error;
    }
}

module.exports = {
    saveEmailLead,
    findEmailLead,
    updateLastAttempt,
    markEmailAsVerified,
};