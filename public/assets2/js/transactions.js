(function () {
    const maxFileSize = 5 * 1024 * 1024;
    const allowedTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
    const filterCategorySelect = document.querySelector("[data-transaction-filter-category]");
    const filterTypeSelect = document.querySelector('form[action="/transactions"] select[name="type"]');
    const hasJQuery = typeof window.jQuery !== "undefined";
    const hasSelect2 = hasJQuery && typeof window.jQuery.fn.select2 === "function";

    function filterCategoryOptionsByType(categorySelect, typeValue) {
        if (!categorySelect) {
            return;
        }

        const normalizedType = String(typeValue || "").trim().toLowerCase();
        const currentValue = categorySelect.value;

        Array.from(categorySelect.options).forEach((option, index) => {
            const optionType = String(option.getAttribute("data-type") || "").trim().toLowerCase();
            const isPlaceholder = !option.value || index === 0;
            const shouldShow = isPlaceholder || !normalizedType || optionType === normalizedType;

            option.hidden = !shouldShow;
        });

        const selectedOption = categorySelect.options[categorySelect.selectedIndex];
        const selectedType = selectedOption ? String(selectedOption.getAttribute("data-type") || "").trim().toLowerCase() : "";
        if (currentValue && normalizedType && selectedType && selectedType !== normalizedType) {
            categorySelect.value = "";
        }
    }

    function initializeTransactionCategoryForm(form) {
        const typeSelect = form.querySelector("[data-transaction-type]");
        const categorySelect = form.querySelector("[data-transaction-category]");

        if (!typeSelect || !categorySelect) {
            return;
        }

        const selectedCategory = categorySelect.getAttribute("data-selected-category") || categorySelect.value;

        filterCategoryOptionsByType(categorySelect, typeSelect.value);

        if (selectedCategory) {
            categorySelect.value = selectedCategory;
        }

        typeSelect.addEventListener("change", () => {
            filterCategoryOptionsByType(categorySelect, typeSelect.value);

            if (!typeSelect.value) {
                categorySelect.selectedIndex = 0;
            }

            if (hasSelect2) {
                window.jQuery(categorySelect).trigger("change.select2");
            }
        });
    }

    function enhanceCategorySelect(select) {
        if (!hasSelect2 || !select) {
            return;
        }

        const $select = window.jQuery(select);
        const dropdownParent = select.closest(".offcanvas, .modal, .card, .content") || document.body;
        if ($select.data("select2")) {
            $select.select2("destroy");
        }

        $select.select2({
            width: "100%",
            minimumResultsForSearch: Infinity,
            dropdownParent: window.jQuery(dropdownParent),
            dropdownCssClass: "category-select2-dropdown",
            containerCssClass: "category-select2"
        });
    }

    function updatePreview(form, fileDataUrl, fileName) {
        const preview = form.querySelector("[data-bill-preview]");
        const downloadLink = form.querySelector("[data-bill-download]");
        const emptyState = form.querySelector("[data-bill-empty-state]");

        if (!preview || !downloadLink) {
            return;
        }

        if (fileDataUrl) {
            preview.src = fileDataUrl;
            preview.classList.remove("d-none");
            downloadLink.href = fileDataUrl;
            downloadLink.download = fileName || "bill-image";
            downloadLink.classList.remove("d-none");
            if (emptyState) {
                emptyState.classList.add("d-none");
            }
            return;
        }

        preview.src = "";
        preview.classList.add("d-none");
        downloadLink.href = "#";
        downloadLink.classList.add("d-none");
        if (emptyState) {
            emptyState.classList.remove("d-none");
        }
    }

    function showAddTransactionError(form, message) {
        const errorBox = form.querySelector("[data-add-transaction-error]");
        if (!errorBox) {
            return;
        }

        errorBox.textContent = message || "";
        errorBox.classList.toggle("d-none", !message);
    }

    function resetAddTransactionForm(form) {
        const fileInput = form.querySelector("[data-bill-file]");
        const dataInput = form.querySelector("[data-bill-data]");
        const nameInput = form.querySelector("[data-bill-name]");
        const mimeInput = form.querySelector("[data-bill-mime]");
        const categorySelect = form.querySelector("[data-transaction-category]");

        form.reset();

        if (fileInput) {
            fileInput.value = "";
        }

        if (dataInput) {
            dataInput.value = "";
        }

        if (nameInput) {
            nameInput.value = "";
        }

        if (mimeInput) {
            mimeInput.value = "";
        }

        if (categorySelect) {
            categorySelect.selectedIndex = 0;
        }

        updatePreview(form, "", "");
        showAddTransactionError(form, "");

        if (hasSelect2) {
            window.jQuery(form).find("[data-transaction-category]").trigger("change.select2");
        }
    }

    document.querySelectorAll(".transaction-bill-form").forEach((form) => {
        const fileInput = form.querySelector("[data-bill-file]");
        const dataInput = form.querySelector("[data-bill-data]");
        const nameInput = form.querySelector("[data-bill-name]");
        const mimeInput = form.querySelector("[data-bill-mime]");

        if (!fileInput || !dataInput || !nameInput || !mimeInput) {
            return;
        }

        updatePreview(form, dataInput.value, nameInput.value);

        fileInput.addEventListener("change", () => {
            const file = fileInput.files && fileInput.files[0];

            if (!file) {
                return;
            }

            if (!allowedTypes.has(file.type)) {
                window.alert("Please upload JPG, PNG, WEBP, or GIF image only.");
                fileInput.value = "";
                return;
            }

            if (file.size > maxFileSize) {
                window.alert("Please upload an image smaller than 5MB.");
                fileInput.value = "";
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                dataInput.value = String(reader.result || "");
                nameInput.value = file.name;
                mimeInput.value = file.type;
                updatePreview(form, dataInput.value, file.name);
            };
            reader.readAsDataURL(file);
        });
    });

    document.querySelectorAll(".transaction-bill-form").forEach(initializeTransactionCategoryForm);
    document.querySelectorAll("[data-transaction-category], [data-transaction-filter-category]").forEach(enhanceCategorySelect);

    if (filterTypeSelect && filterCategorySelect) {
        filterCategoryOptionsByType(filterCategorySelect, filterTypeSelect.value);
        filterTypeSelect.addEventListener("change", () => {
            filterCategoryOptionsByType(filterCategorySelect, filterTypeSelect.value);
            if (hasSelect2) {
                window.jQuery(filterCategorySelect).trigger("change.select2");
            }
        });
    }

    const addTransactionCanvas = document.getElementById("addTransaction");
    if (addTransactionCanvas && addTransactionCanvas.getAttribute("data-open-on-load") === "true" && window.bootstrap?.Offcanvas) {
        window.bootstrap.Offcanvas.getOrCreateInstance(addTransactionCanvas).show();
    }

    const addTransactionForm = document.querySelector("[data-add-transaction-form]");
    if (addTransactionForm) {
        const addTransactionSubmitButton = addTransactionForm.querySelector('button[type="submit"]');
        const addTransactionOffcanvas = addTransactionCanvas && window.bootstrap?.Offcanvas
            ? window.bootstrap.Offcanvas.getOrCreateInstance(addTransactionCanvas)
            : null;

        addTransactionForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            showAddTransactionError(addTransactionForm, "");

            if (addTransactionSubmitButton) {
                addTransactionSubmitButton.disabled = true;
            }

            try {
                const formData = new FormData(addTransactionForm);
                const response = await window.fetch(addTransactionForm.action, {
                    method: "POST",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                        "X-Requested-With": "XMLHttpRequest",
                    },
                    body: new URLSearchParams(formData).toString(),
                });
                const result = await response.json();

                if (!response.ok || !result.success) {
                    showAddTransactionError(addTransactionForm, result.message || "Failed to add transaction");
                    if (addTransactionOffcanvas) {
                        addTransactionOffcanvas.show();
                    }
                    return;
                }

                window.location.href = result.redirect || "/transactions";
            } catch (error) {
                showAddTransactionError(addTransactionForm, "Failed to add transaction");
                if (addTransactionOffcanvas) {
                    addTransactionOffcanvas.show();
                }
            } finally {
                if (addTransactionSubmitButton) {
                    addTransactionSubmitButton.disabled = false;
                }
            }
        });

        if (addTransactionCanvas) {
            addTransactionCanvas.addEventListener("hidden.bs.offcanvas", () => {
                resetAddTransactionForm(addTransactionForm);
            });
        }
    }
}());
