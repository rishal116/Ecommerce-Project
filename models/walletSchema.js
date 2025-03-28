const mongoose = require('mongoose');
const { Schema } = mongoose;

const walletSchema = new Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    balance: {
        type: Number,
        default: null

    },
    transaction: [{
        amount: {
            type: Number
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        transactionId: {
            type: String
        },
        productName: {
            type: [String],
        },
        type: {
            type: String,
            enum: ["credit", 'debit']
        },
        method: {
            type: String,
            enum: ["upi", "wallet", "card", "net banking", "refund","cod"],
        },
        reason: {
            type: String,
            enum: ["return order", "cancel"], 
            default: null
        },
        status: {  
            type: String,
            enum: ["pending", "completed", "failed"],
            default: "completed"
        }
    }]
})

const Wallet = mongoose.model("Wallet", walletSchema)

module.exports = Wallet