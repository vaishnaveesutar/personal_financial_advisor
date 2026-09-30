// ===============================
// FINORA - PERSONAL FINANCE APP
// ===============================

let transactions = [];
let savingsGoal = {
    name: "My Savings Goal",
    target: 100000
};


// ===============================
// PAGE LOAD
// ===============================

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("currentDate").textContent =
        new Date().toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });

    loadData();

    document
        .getElementById("transactionForm")
        .addEventListener("submit", addTransaction);

});


// ===============================
// NAVIGATION
// ===============================

function showSection(sectionId, button = null) {

    document.querySelectorAll(".section").forEach(section => {
        section.classList.remove("active");
    });

    const section = document.getElementById(sectionId);

    if (section) {
        section.classList.add("active");
    }

    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.remove("active");
    });

    if (button) {
        button.classList.add("active");
    }

    if (sectionId === "transactions") {
        renderAllTransactions();
    }

    if (sectionId === "dashboard") {
        updateDashboard();
    }
}


// ===============================
// ADD TRANSACTION
// ===============================

async function addTransaction(event) {

    event.preventDefault();

    const type = document.getElementById("type").value;
    const amount = Number(document.getElementById("amount").value);
    const category = document.getElementById("category").value;
    const description =
        document.getElementById("description").value || category;

    if (!amount || amount <= 0) {
        alert("Please enter a valid amount.");
        return;
    }

    const transaction = {
        type: type,
        amount: amount,
        category: category,
        description: description
    };

    try {

        const response = await fetch("/api/entries", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(transaction)
        });

        if (!response.ok) {
            throw new Error("Unable to save transaction.");
        }

        document.getElementById("transactionForm").reset();

        await loadData();

        alert("Transaction added successfully! ✅");

    } catch (error) {

        console.error(error);

        // Temporary local fallback
        transactions.push({
            ...transaction,
            id: Date.now()
        });

        document.getElementById("transactionForm").reset();

        updateDashboard();
        renderRecentTransactions();

        alert("Transaction saved locally. ✅");
    }
}


// ===============================
// LOAD DATA
// ===============================

async function loadData() {

    try {

        const response = await fetch("/api/entries");

        if (!response.ok) {
            throw new Error("Could not load data");
        }

        transactions = await response.json();

    } catch (error) {

        console.log("Using local data.");

        const saved =
            localStorage.getItem("finora_transactions");

        if (saved) {
            transactions = JSON.parse(saved);
        }
    }

    updateDashboard();
    renderRecentTransactions();
}


// ===============================
// DASHBOARD
// ===============================

function updateDashboard() {

    let income = 0;
    let expenses = 0;

    transactions.forEach(transaction => {

        if (transaction.type === "income") {
            income += Number(transaction.amount);
        } else {
            expenses += Number(transaction.amount);
        }

    });

    const savings = income - expenses;

    let rate = 0;

    if (income > 0) {
        rate = (savings / income) * 100;
    }

    document.getElementById("income").textContent =
        formatCurrency(income);

    document.getElementById("expenses").textContent =
        formatCurrency(expenses);

    document.getElementById("savings").textContent =
        formatCurrency(savings);

    document.getElementById("rate").textContent =
        `${Math.max(0, rate).toFixed(1)}%`;

    renderCategoryBars();
    renderRecentTransactions();
    updateGoal();
}


// ===============================
// CATEGORY BREAKDOWN
// ===============================

function renderCategoryBars() {

    const container =
        document.getElementById("categoryBars");

    const categories = {};

    transactions.forEach(transaction => {

        if (transaction.type !== "expense") {
            return;
        }

        const category = transaction.category;

        if (!categories[category]) {
            categories[category] = 0;
        }

        categories[category] += Number(transaction.amount);

    });

    const entries = Object.entries(categories);

    if (entries.length === 0) {

        container.innerHTML = `
            <p class="empty-message">
                Add some expenses to see your spending.
            </p>
        `;

        return;
    }

    const total =
        entries.reduce((sum, item) => sum + item[1], 0);

    entries.sort((a, b) => b[1] - a[1]);

    container.innerHTML = "";

    entries.forEach(([category, amount]) => {

        const percentage =
            total > 0
                ? (amount / total) * 100
                : 0;

        const row = document.createElement("div");

        row.className = "category-row";

        row.innerHTML = `
            <div class="category-info">
                <span>${escapeHTML(category)}</span>
                <span>${formatCurrency(amount)}</span>
            </div>

            <div class="bar">
                <div
                    class="bar-fill"
                    style="width: ${percentage}%"
                ></div>
            </div>
        `;

        container.appendChild(row);

    });
}


// ===============================
// RECENT TRANSACTIONS
// ===============================

function renderRecentTransactions() {

    const container =
        document.getElementById("recentTransactions");

    if (!transactions.length) {

        container.innerHTML = `
            <p class="empty-message">
                No transactions yet.
            </p>
        `;

        return;
    }

    const recent =
        [...transactions].reverse().slice(0, 5);

    container.innerHTML = recent
        .map(transactionHTML)
        .join("");
}


// ===============================
// ALL TRANSACTIONS
// ===============================

function renderAllTransactions() {

    const container =
        document.getElementById("allTransactions");

    if (!transactions.length) {

        container.innerHTML = `
            <p class="empty-message">
                No transactions available.
            </p>
        `;

        return;
    }

    container.innerHTML =
        [...transactions]
            .reverse()
            .map(transactionHTML)
            .join("");
}


// ===============================
// TRANSACTION HTML
// ===============================

function transactionHTML(transaction) {

    const isIncome =
        transaction.type === "income";

    const sign =
        isIncome ? "+" : "-";

    const icon =
        isIncome ? "↗" : "↘";

    return `
        <div class="transaction-item">

            <div class="transaction-left">

                <div class="transaction-icon">
                    ${icon}
                </div>

                <div>
                    <div class="transaction-name">
                        ${escapeHTML(
                            transaction.description ||
                            transaction.category
                        )}
                    </div>

                    <div class="transaction-category">
                        ${escapeHTML(transaction.category)}
                    </div>
                </div>

            </div>

            <div class="transaction-amount ${isIncome ? "income" : "expense"}">
                ${sign}${formatCurrency(transaction.amount)}
            </div>

        </div>
    `;
}


// ===============================
// AI ADVISOR
// ===============================

async function getAdvice() {

    const result =
        document.getElementById("aiResult");

    result.classList.remove("hidden");

    result.innerHTML = `
        <div class="empty-message">
            ✦ Analyzing your finances...
        </div>
    `;

    try {

        const response =
            await fetch("/api/analyze", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "AI analysis failed");
        }

        result.innerHTML = `
            <p class="eyebrow">AI FINANCIAL INSIGHT</p>
            <h2>Your Personalized Analysis</h2>
            <br>
            <div>${formatAIResponse(data.advice)}</div>
        `;

    } catch (error) {

        console.error(error);

        result.innerHTML = `
            <p class="eyebrow">AI FINANCIAL INSIGHT</p>

            <h2>Basic Financial Analysis</h2>

            <br>

            <p>
                Add your income and expenses to receive
                personalized financial suggestions.
            </p>

            <br>

            <p>
                💡 Try to keep your essential expenses
                under control and set aside a fixed amount
                for savings every month.
            </p>
        `;
    }
}


// ===============================
// SAVINGS GOAL
// ===============================

function saveGoal() {

    const name =
        document.getElementById("goalInputName").value;

    const target =
        Number(
            document.getElementById("goalInputAmount").value
        );

    if (!name || !target || target <= 0) {

        alert("Please enter a goal name and target amount.");

        return;
    }

    savingsGoal = {
        name: name,
        target: target
    };

    localStorage.setItem(
        "finora_goal",
        JSON.stringify(savingsGoal)
    );

    updateGoal();

    alert("Savings goal created! 🎯");
}


function updateGoal() {

    const saved =
        transactions
            .filter(transaction => transaction.type === "income")
            .reduce((sum, transaction) =>
                sum + Number(transaction.amount), 0)
        -
        transactions
            .filter(transaction => transaction.type === "expense")
            .reduce((sum, transaction) =>
                sum + Number(transaction.amount), 0);

    const safeSaved = Math.max(0, saved);

    const percentage =
        savingsGoal.target > 0
            ? Math.min(
                100,
                (safeSaved / savingsGoal.target) * 100
            )
            : 0;

    document.getElementById("goalName").textContent =
        savingsGoal.name;

    document.getElementById("goalSaved").textContent =
        Math.round(safeSaved).toLocaleString("en-IN");

    document.getElementById("goalTarget").textContent =
        Math.round(savingsGoal.target).toLocaleString("en-IN");

    document.getElementById("goalPercent").textContent =
        `${Math.round(percentage)}%`;

    const degrees =
        percentage * 3.6;

    document.querySelector(".goal-circle").style.background = `
        radial-gradient(
            circle,
            #10172c 58%,
            transparent 59%
        ),
        conic-gradient(
            #20d9c4 ${degrees}deg,
            #7c5cff ${Math.max(0, degrees - 25)}deg,
            rgba(255,255,255,0.07) ${degrees}deg
        )
    `;
}


// ===============================
// HELPERS
// ===============================

function formatCurrency(amount) {

    return Number(amount || 0).toLocaleString(
        "en-IN",
        {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0
        }
    );
}


function escapeHTML(value) {

    const div = document.createElement("div");

    div.textContent = value ?? "";

    return div.innerHTML;
}


function formatAIResponse(text) {

    let formatted = escapeHTML(text);

    // Convert Markdown headings
    formatted = formatted.replace(
        /^###\s*(.*?)$/gm,
        '<h3 class="ai-heading">$1</h3>'
    );

    // Convert bold text
    formatted = formatted.replace(
        /\*\*(.*?)\*\*/g,
        '<strong>$1</strong>'
    );

    // Convert bullet points
    formatted = formatted.replace(
        /^\s*\*\s+(.*?)$/gm,
        '<div class="ai-bullet">• $1</div>'
    );

    // Convert numbered points
    formatted = formatted.replace(
        /^\s*(\d+)\.\s+(.*?)$/gm,
        '<div class="ai-number"><span>$1</span><p>$2</p></div>'
    );

    // Convert horizontal separators
    formatted = formatted.replace(
        /^\s*---\s*$/gm,
        '<div class="ai-divider"></div>'
    );

    // Convert remaining line breaks
    formatted = formatted.replace(
        /\n{2,}/g,
        '<div class="ai-space"></div>'
    );

    formatted = formatted.replace(
        /\n/g,
        '<br>'
    );

    return formatted;
}


// ===============================
// LOAD SAVINGS GOAL
// ===============================

const storedGoal =
    localStorage.getItem("finora_goal");

if (storedGoal) {

    try {

        savingsGoal =
            JSON.parse(storedGoal);

    } catch (error) {

        console.log("Could not load saved goal.");

    }
}
async function resetDemoData() {
    const confirmed = confirm(
        "Are you sure you want to delete all transaction data?"
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch("/api/reset", {
            method: "POST"
        });

        const data = await response.json();

        if (data.success) {
            alert("Demo data has been reset.");

            await loadData();
            updateDashboard();
        } else {
            alert("Unable to reset the data.");
        }

    } catch (error) {
        console.error("Reset error:", error);
        alert("Something went wrong while resetting the data.");
    }
}