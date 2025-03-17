const User = require('../../models/userSchema')
const Razorpay = require('razorpay');
require('dotenv').config();
const Wallet = require('../../models/walletSchema')
const crypto = require('crypto');
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const loadWallet = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found!' });
        }

        const wallet = await Wallet.findOne({ user: userId });

        if (!wallet) {
            return res.render('wallet', { 
                walletBalance: 0, 
                transactions: [], 
                user: user,
                currentPage: 1,
                totalPages: 1, 
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 5; 
        const skip = (page - 1) * limit

        const sortedTransactions = wallet.transaction.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const paginatedTransactions = sortedTransactions.slice(skip, skip + limit);
        const totalPages = Math.ceil(wallet.transaction.length / limit);
        
        res.render('wallet', { 
            walletBalance: wallet.balance, 
            transactions: paginatedTransactions, 
            user: user,
            currentPage: page,
            totalPages: totalPages,
        });

    } catch (error) {
        console.error('Error while loading the wallet:', error);
        res.status(500).send('Internal Server Error');
    }
};

const payWithWallet = async (req, res) => {

    try {

        const userId = req.session.user
        
        const { paymentAmount } = req.body
       

        const wallet = await Wallet.findOne({ user: userId })

        const walletBalance = wallet ? wallet.balance : 0; 
 
        
        if (walletBalance < paymentAmount) {
            res.status(400).json({ success: false, message: 'Insufficient balance in the wallet!' })
            return;
        }
 
        res.status(200).json({ success: true, message: 'You have an isuffucent balance in the wallet' })
 
    } catch (error) {

        console.log('Error while paying with wallet: ', error);
        res.redirect('/pageNotfound')

    }
}

const verifyAddMoneyPayment = async (req, res) => {
    try {
        const userId = req.session.user;
        console.log("Received Payment Details:", req.body);

        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: 'Missing payment details'
            });
        }

        console.log('Razorpay Secret:', process.env.RAZORPAY_KEY_SECRET ? 'Loaded' : 'Not Loaded');

        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment signature'
            });
        }

        let payment;
        try {
            payment = await razorpay.payments.fetch(razorpay_payment_id);
            console.log('Fetched Payment:', payment);
        } catch (err) {
            console.error('Error Fetching Payment:', err);
            return res.status(500).json({ success: false, message: 'Error fetching payment' });
        }

        if (payment.status !== 'captured') {
            console.log('Payment not captured, attempting capture...');
            try {
                await razorpay.payments.capture(razorpay_payment_id, payment.amount, 'INR');
                console.log('Payment Captured Successfully');
            } catch (err) {
                console.error('Error Capturing Payment:', err);
                return res.status(400).json({
                    success: false,
                    message: 'Payment could not be captured'
                });
            }
        }

        const amountInRupees = payment.amount / 100;
        let wallet = await Wallet.findOne({ user: userId });

        if (!wallet) {
            wallet = new Wallet({
                user: userId,
                balance: 0,
                transaction: []
            });
        }

        wallet.balance += amountInRupees;
        wallet.transaction.push({
            amount: amountInRupees,
            createdAt: new Date(),
            transactionId: razorpay_payment_id,
            type: 'credit',
            productName: ['Wallet Recharge'],
            method: "wallet"
        });

        await wallet.save();

        res.json({
            success: true,
            message: 'Money added to wallet successfully',
            newBalance: wallet.balance
        });

    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify payment'
        });
    }
};

const createAddMoneyOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { amount } = req.body;

        // ✅ Validate amount
        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid amount'
            });
        }

        // ✅ Validate user session
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        // ✅ Find user in database
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // ✅ Create Razorpay order
        const options = {
            amount: amount * 100,  // Convert to paise
            currency: 'INR',
            receipt: `wallet-${userId.slice(-6)}-${Date.now().toString().slice(-6)}`,
            notes: {
                userId: userId,
                type: 'wallet_recharge'
            }
        };        
        
        const order = await razorpay.orders.create(options);

        // ✅ Send response
        res.json({
            success: true,
            key_id: process.env.RAZORPAY_KEY_ID, // Fixed env variable name
            order: order,
            user: {
                name: user.name,
                email: user.email,
                phone: user.phoneNumber
            }
        });

    } catch (error) {
        console.error('Error creating add money order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment order'
        });
    }
};

module.exports = {
    loadWallet,
    payWithWallet,
    verifyAddMoneyPayment,
    createAddMoneyOrder,
}