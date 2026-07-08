const connectDB = require("../config/db");

async function saveSession(data) {
    try {
        const db = await connectDB();

        return await db.collection("user_sessions").insertOne({
            sessionId: data.sessionId,
            userId: data.userId,
            email: data.email,

            ipAddress: data.ipAddress,
            userAgent: data.userAgent,

            loginAt: new Date(),
            logoutAt: null,

            isActive: true,

            createdAt: new Date(),
        });

    } catch (error) {
        console.error("Error saving session:", error);
        throw error;
    }
}

async function logoutSession(sessionId) {
    try {
        const db = await connectDB();

        return await db.collection("user_sessions").updateOne(
            {
                sessionId,
                isActive: true,
            },
            {
                $set: {
                    isActive: false,
                    logoutAt: new Date(),
                },
            }
        );

    } catch (error) {
        console.error("Error updating session:", error);
        throw error;
    }
}

module.exports = {
    saveSession,
    logoutSession,
};