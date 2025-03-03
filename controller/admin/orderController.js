const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
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
        if (!itemId || !status) {
            return res.status(400).json({ success: false, message: 'Order ID and status are required' })
        }
        
        const updatedOrder = await Order.findOneAndUpdate(
            { orderId: itemId },
            { $set: { status } },
            { new: true }
        )
        
        if (!updatedOrder) {
            return res.status(404).json({ success: false, message: 'Order not found' })
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
            return res.redirect('/pageNotFound')
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

module.exports = {
  getOrderListPageAdmin,
  changeOrderStatus,
  getOrderDetailsPageAdmin,
  searchOrders,
}
