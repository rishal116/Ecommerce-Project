const User = require('../../models/userSchema')
const Wallet = require('../../models/walletSchema')

const renderTransactionsPage = async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1; 
        let limit = 5; 
        let skip = (page - 1) * limit;

        const transactionsAggregate = await Wallet.aggregate([
            { $unwind: "$transaction" }, 
            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "user",
                },
            },
            { $unwind: "$user" },
            { $sort: { "transaction.createdAt": -1 } },
            { $skip: skip }, 
            { $limit: limit }, 
            {
                $project: {
                    "transaction": 1,
                    "user.name": 1,
                    "user.email": 1,
                    "user._id": 1,
                }
            }
        ]);

        const totalTransactions = await Wallet.aggregate([
            { $unwind: "$transaction" },
            { $count: "total" }
        ]);

        const totalPages = totalTransactions.length > 0 ? Math.ceil(totalTransactions[0].total / limit) : 1;

        res.render('transaction', { 
            transactions: transactionsAggregate, 
            currentPage: page, 
            totalPages 
        });

    } catch (error) {
        console.error("Error loading transactions:", error);
        res.status(500).send("Error loading transactions");
    }
};

const renderTransactionDetailsPage = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const wallet = await Wallet.findOne({ "transaction.transactionId": transactionId }).populate("user", "name email");

        if (!wallet) {
            return res.status(404).send("Transaction not found");
        }

        const transactionDetails = wallet.transaction.find(t => t.transactionId === transactionId);
        res.render('transactionDetailPage', { transaction: transactionDetails, user: wallet.user });
    } catch (error) {
        res.status(500).send("Error loading transaction details");
    }
};

const renderWalletPage = async (req, res) => {
    try {

        const { userId } = req.params

        let page = parseInt(req.query.page) || 1;
        let limit = 5; 
        let skip = (page - 1) * limit;

        const wallet = await Wallet.findOne({ user: userId })
            .populate("user", "name email")
            .lean(); 

        if (!wallet) {
            console.log("No wallet found for user:", userId);
            return res.status(404).send("Wallet not found for this user");
        }

        wallet.transaction = wallet.transaction.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const transactions = wallet.transaction.slice(skip, skip + limit);
        const totalTransactions = wallet.transaction.length;
        const totalPages = Math.ceil(totalTransactions / limit);


        res.render('userWalletDetailPage', { 
            wallet, 
            transactions, 
            currentPage: page,
            totalPages
        });
    } catch (error) {
        console.error("Error loading wallet details:", error);
        res.status(500).send("Error loading wallet details");
    }
};



module.exports = {
    renderTransactionsPage,
    renderTransactionDetailsPage,
    renderWalletPage
}