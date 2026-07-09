(function () {
    const toasts = Array.from(document.querySelectorAll("[data-flash-toast]"));

    if (!toasts.length) {
        return;
    }

    function hideToast(toast) {
        if (!toast || toast.classList.contains("is-hiding")) {
            return;
        }

        toast.classList.add("is-hiding");
        toast.addEventListener("transitionend", function handleTransitionEnd() {
            toast.removeEventListener("transitionend", handleTransitionEnd);
            toast.remove();
        });
    }

    toasts.forEach(function (toast, index) {
        const closeButton = toast.querySelector("[data-toast-close]");

        window.setTimeout(function () {
            toast.classList.add("is-visible");
        }, 20 + (index * 90));

        const hideTimer = window.setTimeout(function () {
            hideToast(toast);
        }, 4200 + (index * 450));

        if (closeButton) {
            closeButton.addEventListener("click", function () {
                window.clearTimeout(hideTimer);
                hideToast(toast);
            });
        }
    });
}());
