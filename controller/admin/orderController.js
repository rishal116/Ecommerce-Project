const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");
const mongodb = require("mongodb");
const mongoose = require('mongoose')
const razorpay = require("razorpay");
const env = require("dotenv").config();
const crypto = require("crypto");
const Coupon=require("../../models/couponSchema");
const { v4: uuidv4 } = require('uuid');


const getOrderListPageAdmin = async (req, res) => {
    try {
        let search = ''
        let page = 1
        if(req.query.page){
            page = req.query.page
        }
        
        const limit = 4
        const orders = await Order.find({
            $or: [
                { orderId: { $regex:".*"+search+".*" } },
                { "userId.name": { $regex:".*"+search+".*" } },
            ],
        })
        .populate({
            path: 'userId',
            model: 'User',
            select: 'name'
        })
        .sort({ createdOn: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .lean()
        
        const count = await Order.find({
            $or: [
                { orderId: { $regex:".*"+search+".*" } },
                { "userId.name": { $regex:".*"+search+".*" } },
            ],
        })
        .populate({
            path: 'userId',
            model: 'User',
            select: 'name'
        }).countDocuments()
        
        const totalPages = Math.ceil(count / limit)
        
        const formattedOrders = orders.map(order => ({
            orderId: order.orderId,
            userName: order.userId ? order.userId.name : 'Guest User',
            date: order.createdOn,
            totalAmount: order.finalAmount,
            status: order.status,
            paymentMethod: order.paymentMethod,
        }))
        
        res.render('orderList', { orders: formattedOrders ,totalPages:totalPages, currentPage:page })
    } catch (error) {
        console.error('Error while loading order list: ', error)
        res.redirect('/admin/pageError')
    }
}

const changeOrderStatus = async (req, res) => {
    try {
        const { itemId, status } = req.body
        console.log(req.body)
        if (!itemId || !status) {
            return res.status(400).json({ success: false, message: 'Order ID and status are required' })
        }
        
        const updatedOrder = await Order.findOneAndUpdate(
            { orderId: itemId },
            { $set: { status } },
            { new: true }
        )

        console.log("updateOdrder: ",updatedOrder)

        
        if (!updatedOrder) {
            return res.status(404).json({ success: false, message: 'Order not found' })
        }

        if (status == 'Delivered') {
            const walletUpdate = await Wallet.updateOne(
                { 
                    user: updatedOrder.userId, 
                    "transaction.transactionId": itemId, 
                    "transaction.method": "cod"  // Ensure payment method is COD
                },
                { $set: { "transaction.$.status": "completed" } }
            );

            if (walletUpdate.matchedCount === 0) {
                console.warn(`No matching COD transaction found for order ${itemId}`);
            }
        }
        
        return res.status(200).json({ success: true, message: 'Order status updated successfully', order: updatedOrder })
    } catch (error) {
        console.error('Error while updating the status:', error)
        return res.status(500).json({ success: false, message: 'Internal Server Error' })
    }
}

const getOrderDetailsPageAdmin = async (req, res) => {
    try {
        const orderId = req.params.id
        const order = await Order.findOne({ orderId }).lean()
        
        if (!order) {
            console.log('Order not found: ', orderId)
            return res.redirect('/admin/orderList')
        }
        
        res.render('orderDetailsAdmin', { order })
    
    } catch (error) {
        console.error('Error while loading the order details: ', error)
        res.redirect('/admin/pageError')
    }
}

const searchOrders = async (req, res) => {
    try {
        let search = req.query.search ? req.query.search.trim() : ""
        let page = req.query.page ? parseInt(req.query.page) : 1
        const limit = 4
        let query = {}
        if (search) {
            const userMatch = await User.find({
                name: { $regex: search, $options: "i" },
            }).select("_id")
            const userIds = userMatch.map(user => user._id)
            query.$or = [
                { orderId: { $regex: search, $options: "i" } },
                { userId: { $in: userIds } },
            ]
        }
        
        const orders = await Order.find(query)
        .populate({
            path: "userId",
            model: "User",
            select: "name",
        })
        .sort({ createdOn: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .lean()
        
        const count = await Order.countDocuments(query)
        const totalPages = Math.ceil(count / limit)
        
        const formattedOrders = orders.map(order => ({
            orderId: order.orderId,
            userName: order.userId ? order.userId.name : "Guest User",
            date: order.createdOn,
            totalAmount: order.finalAmount,
            status: order.status,
            paymentMethod: order.paymentMethod,
        }))
        
        res.render("orderList", {
            orders: formattedOrders,
            totalPages,
            currentPage: page,
            search,
        })
    
    } catch (error) {
        console.error("Error while loading order list: ", error)
        res.redirect("/admin/pageError")
    }
}

const handleReturn = async (req, res) => {
    try {
        const { orderId, productId, status, finalAmount } = req.body
        const order = await Order.findOne({ orderId }).populate("userId")
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const item = order.orderItems.find(item => item.productId.toString() === productId)
        if (!item) {
            return res.status(404).json({ success: false, message: 'Product not found in the order' });
        }
        
        item.returnRequest.status = status
        item.returnRequest.requestDate = new Date()

        if (status === 'Approved') {
            order.status = 'Return Accepted'
            const userId = order.userId._id
            
            let wallet = await Wallet.findOne({ user: userId })
            if (!wallet) {
                wallet = new Wallet({ user: userId, balance: 0, transaction: [] })
            }
            
            const refundAmount = item.price * item.quantity
            
            wallet.balance = parseInt(wallet.balance) + parseInt(refundAmount)
            
            wallet.transaction.push({
                amount: refundAmount,
                transactionId: `${orderId}`,
                productName: [item.productName],
                type: "credit",
                method: "refund",
                reason: "return order"
            })
            await wallet.save()
        } else if (status === 'Rejected') {
            order.status = 'Return Rejected'
        }
        await order.save()
        return res.status(200).json({ success: true, message: `Product return ${status.toLowerCase()}!`, order })
    } catch (error) {
        console.error('Error while handling the return:', error)
        return res.status(500).json({ success: false, message: 'Internal server error' })
    }
}


module.exports = {
  getOrderListPageAdmin,
  changeOrderStatus,
  getOrderDetailsPageAdmin,
  searchOrders,
  handleReturn,
}
