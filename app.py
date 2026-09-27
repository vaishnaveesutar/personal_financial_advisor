from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
from google import genai
import os
import time
from datetime import datetime

# ==========================================
# LOAD ENVIRONMENT VARIABLES
# ==========================================

load_dotenv()


# ==========================================
# CREATE FLASK APP
# ==========================================

app = Flask(__name__)

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///finance.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


# ==========================================
# DATABASE MODEL
# ==========================================

class Transaction(db.Model):

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    type = db.Column(
        db.String(20),
        nullable=False
    )

    amount = db.Column(
        db.Float,
        nullable=False
    )

    category = db.Column(
        db.String(50),
        nullable=False
    )

    description = db.Column(
        db.String(200)
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )


# ==========================================
# HOME PAGE
# ==========================================

@app.route("/")
def home():

    return render_template("index.html")


# ==========================================
# GET ALL TRANSACTIONS
# ==========================================

@app.route("/api/entries", methods=["GET"])
def get_entries():

    entries = Transaction.query.order_by(
        Transaction.created_at.desc()
    ).all()

    data = []

    for entry in entries:

        data.append({
            "id": entry.id,
            "type": entry.type,
            "amount": entry.amount,
            "category": entry.category,
            "description": entry.description,
            "created_at": entry.created_at.strftime(
                "%Y-%m-%d %H:%M:%S"
            )
        })

    return jsonify(data)


# ==========================================
# ADD TRANSACTION
# ==========================================

@app.route("/api/entries", methods=["POST"])
def add_entry():

    data = request.get_json()

    if not data:

        return jsonify({
            "error": "No data received"
        }), 400

    transaction_type = data.get("type")
    amount = data.get("amount")
    category = data.get("category")
    description = data.get(
        "description",
        ""
    )

    if not transaction_type:
        return jsonify({
            "error": "Transaction type is required"
        }), 400

    if not amount:
        return jsonify({
            "error": "Amount is required"
        }), 400

    if not category:
        return jsonify({
            "error": "Category is required"
        }), 400

    try:

        amount = float(amount)

        if amount <= 0:
            raise ValueError

    except (ValueError, TypeError):

        return jsonify({
            "error": "Invalid amount"
        }), 400

    new_transaction = Transaction(
        type=transaction_type,
        amount=amount,
        category=category,
        description=description
    )

    db.session.add(new_transaction)

    db.session.commit()

    return jsonify({
        "message": "Transaction added successfully",
        "id": new_transaction.id
    }), 201


# ==========================================
# AI FINANCIAL ANALYSIS
# ==========================================

@app.route("/api/analyze", methods=["POST"])
def analyze_finances():

    transactions = Transaction.query.all()

    # --------------------------------------
    # No transactions
    # --------------------------------------

    if not transactions:

        return jsonify({
            "advice": (
                "There are no transactions yet.\n\n"
                "Please add your income and expenses "
                "first so the financial advisor can "
                "analyze your finances."
            )
        })


    # --------------------------------------
    # Calculate income
    # --------------------------------------

    total_income = sum(
        transaction.amount
        for transaction in transactions
        if transaction.type == "income"
    )


    # --------------------------------------
    # Calculate expenses
    # --------------------------------------

    total_expenses = sum(
        transaction.amount
        for transaction in transactions
        if transaction.type == "expense"
    )


    # --------------------------------------
    # Calculate savings
    # --------------------------------------

    savings = (
        total_income -
        total_expenses
    )


    # --------------------------------------
    # Calculate savings rate
    # --------------------------------------

    if total_income > 0:

        savings_rate = (
            savings /
            total_income
        ) * 100

    else:

        savings_rate = 0


    # --------------------------------------
    # Expense categories
    # --------------------------------------

    categories = {}

    for transaction in transactions:

        if transaction.type == "expense":

            category = transaction.category

            categories[category] = (
                categories.get(category, 0)
                + transaction.amount
            )


    # --------------------------------------
    # Create category text
    # --------------------------------------

    if categories:

        category_text = "\n".join(
            f"- {category}: ₹{amount:.0f}"
            for category, amount
            in categories.items()
        )

    else:

        category_text = (
            "No expense categories available."
        )


    # ======================================
    # CHECK GEMINI API KEY
    # ======================================

    api_key = os.getenv(
        "GEMINI_API_KEY"
    )


    # ======================================
    # LOCAL FALLBACK FUNCTION
    # ======================================

    def local_advice():

        if savings > 0:

            saving_message = (
                f"You currently have approximately "
                f"₹{savings:.0f} available after expenses."
            )

        elif savings == 0:

            saving_message = (
                "Your income and expenses are currently equal."
            )

        else:

            saving_message = (
                f"Your expenses are approximately "
                f"₹{abs(savings):.0f} higher than your income."
            )


        if categories:

            highest_category = max(
                categories,
                key=categories.get
            )

            highest_amount = categories[
                highest_category
            ]

            spending_message = (
                f"Your highest expense category is "
                f"{highest_category} at "
                f"₹{highest_amount:.0f}."
            )

        else:

            spending_message = (
                "There is not enough expense data "
                "to identify your highest spending category."
            )


        return f"""
FINANCIAL SUMMARY

Monthly Income:
₹{total_income:.0f}

Total Expenses:
₹{total_expenses:.0f}

Available Savings:
₹{savings:.0f}

Savings Rate:
{savings_rate:.1f}%


KEY OBSERVATION

{saving_message}

{spending_message}


PRACTICAL SUGGESTIONS

1. Track your expenses regularly.

2. Review your highest spending category
   and look for expenses that can be reduced.

3. Set a fixed monthly savings target.

4. Keep an emergency savings buffer.

5. Review your budget at the end of every month.


NEXT MONTH GOAL

Try to maintain or improve your current
savings rate while keeping essential
expenses under control.
"""


    # ======================================
    # IF NO API KEY
    # ======================================

    if not api_key:

        return jsonify({
            "advice": local_advice()
        })


    # ======================================
    # CREATE GEMINI CLIENT
    # ======================================

    try:

        client = genai.Client(
            api_key=api_key
        )

    except Exception as error:

        print(
            "Gemini client error:",
            error
        )

        return jsonify({
            "advice": local_advice()
        })


    # ======================================
    # AI PROMPT
    # ======================================

    prompt = f"""
You are a personal budgeting assistant
inside a web application called Finora.

Analyze this user's financial information.

INCOME:
₹{total_income:.0f}

TOTAL EXPENSES:
₹{total_expenses:.0f}

CURRENT SAVINGS:
₹{savings:.0f}

SAVINGS RATE:
{savings_rate:.1f}%

EXPENSE CATEGORIES:
{category_text}


Give practical and easy-to-understand
personal budgeting advice.

Include exactly these sections:

1. FINANCIAL SUMMARY
Briefly explain the current situation.

2. SPENDING ANALYSIS
Identify the important spending areas.

3. THREE WAYS TO SAVE
Give three realistic suggestions.

4. SAVINGS PLAN
Suggest a practical monthly savings target.

5. NEXT MONTH GOAL
Give one simple financial goal.

Do not recommend stocks,
cryptocurrency,
specific financial products,
or guaranteed investment returns.

Keep the response concise and suitable
for a student-friendly finance dashboard.
"""


    # ======================================
    # GEMINI MODEL LIST
    # ======================================

    models = [
        "gemini-3.8-flash",
        "gemini-3.7-flash"
    ]


    # ======================================
    # TRY GEMINI MODELS
    # ======================================

    last_error = None

    for model_name in models:

        for attempt in range(3):

            try:

                print(
                    f"Trying {model_name} "
                    f"(attempt {attempt + 1})"
                )


                response = client.models.generate_content(

                    model=model_name,

                    contents=prompt
                )


                if response and response.text:

                    print(
                        f"Gemini success using "
                        f"{model_name}"
                    )

                    return jsonify({
                        "advice": response.text
                    })


            except Exception as error:

                last_error = error

                print(
                    f"Gemini error using "
                    f"{model_name}:",
                    error
                )


                # ----------------------------------
                # Retry temporary server errors
                # ----------------------------------

                error_text = str(
                    error
                ).lower()


                temporary_error = (

                    "503" in error_text

                    or
                    "unavailable" in error_text

                    or
                    "500" in error_text

                    or
                    "502" in error_text

                    or
                    "504" in error_text

                    or
                    "429" in error_text

                )


                if temporary_error:

                    if attempt < 2:

                        wait_time = (
                            2 ** attempt
                        )

                        print(
                            f"Retrying in "
                            f"{wait_time} seconds..."
                        )

                        time.sleep(
                            wait_time
                        )

                    continue


                # ----------------------------------
                # Don't retry permanent errors
                # ----------------------------------

                break


    # ======================================
    # GEMINI FAILED
    # ======================================

    print(
        "All Gemini attempts failed:",
        last_error
    )


    return jsonify({
        "advice": (
            local_advice()
            +
            "\n\n"
            "NOTE: Gemini AI is temporarily "
            "unavailable. The summary above was "
            "generated locally from your financial "
            "data."
        )
    })


# ==========================================
# CREATE DATABASE
# ==========================================

with app.app_context():

    db.create_all()


# ==========================================
# START APPLICATION
# ==========================================

import os

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=False
    )
