(function () {
    const loginCard = document.querySelector(".login-auth-card");
    const resendForm = document.getElementById("resendForm");
    const resendBtn = document.getElementById("resendBtn");
    const resendTimer = document.getElementById("resendTimer");

    if (!loginCard || !resendForm || !resendBtn || !resendTimer) {
        return;
    }

    const cooldown = Number(loginCard.dataset.otpExpirySeconds || 60);
    const otpSentAtRaw = loginCard.dataset.otpSentAt;
    const otpSentAt = otpSentAtRaw ? Number(otpSentAtRaw) : null;
    let timerId = null;

    function startTimer(remaining) {
        if (timerId) {
            clearInterval(timerId);
        }

        resendBtn.disabled = true;
        resendBtn.classList.add("disabled");
        resendTimer.textContent = `Please wait ${remaining}s to resend`;

        timerId = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                clearInterval(timerId);
                timerId = null;
                resendBtn.disabled = false;
                resendBtn.classList.remove("disabled");
                resendTimer.textContent = "You can request a new OTP now.";
            } else {
                resendTimer.textContent = `Please wait ${remaining}s to resend`;
            }
        }, 1000);
    }

    if (otpSentAt) {
        const elapsed = Math.floor((Date.now() - otpSentAt) / 1000);
        const remaining = Math.max(0, cooldown - elapsed);
        if (remaining > 0) {
            startTimer(remaining);
        }
    }

    resendForm.addEventListener("submit", function () {
        startTimer(cooldown);
    });
}());
