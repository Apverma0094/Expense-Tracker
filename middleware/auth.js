function auth(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.redirect("/");
    }

    next();
}

function alreadyAuth(req, res, next) {
    if (req.session && req.session.userId) {
        return res.redirect("/dashboard");
    }

    next();
}

module.exports = {
    auth,
    alreadyAuth,
};