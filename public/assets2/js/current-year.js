(function () {
    const year = new Date().getFullYear();

    document.querySelectorAll("[data-current-year]").forEach((element) => {
        element.textContent = String(year);
    });
}());
