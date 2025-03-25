const User = require("../../models/userSchema")
const Order = require("../../models/orderSchema")
const Coupon = require("../../models/couponSchema")
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")

const pageError = async(req,res)=> {
    try{
        res.render("adminError",{message:"We can't find the page you're looking for."})
    }
    catch(error){
        console.log("Error in pageError",error)
        res.redirect("/admin/pageError")
    }
}

const loadLogin = async(req,res)=>{
    if(req.session.admin){
        return res.redirect("/admin")
    }
    res.render("adminLogin",{message:null})
}

const login = async(req,res)=>{
    try {
        const {email,password} = req.body
        const admin = await User.findOne({email,isAdmin:true})
        const adminPass = admin.password

        if(admin){
            if(adminPass == password){
                req.session.admin = true
                return res.redirect("/admin")
            }else{
                return res.redirect("/admin/login")
            }
        }else{
            return res.redirect("/admin/login")
        }
    } catch (error) {
        console.error("Error in login: ",error)
        return res.redirect("/admin/pageError")
    }
}

const loadDashboard = async (req, res) => {
    try {
        const period = req.query.period || 'all'
        let startDate = new Date()
        const endDate = new Date()
        endDate.setUTCHours(23, 59, 59, 999)
        
        switch (period) {
            case '1day': startDate.setDate(endDate.getDate() - 1)
            break
            case '1week': startDate.setDate(endDate.getDate() - 7)
            break
            case '1month': startDate.setMonth(endDate.getMonth() - 1)
            break
            default: startDate = null
        }
        
        const dateFilter = startDate ? { createdOn: { $gte: startDate, $lte: endDate } } : {}
        
        const orderStats = await Order.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    totalAmount: { $sum: "$finalAmount" }
                }
            }
        ])
        
        const totalOrders = orderStats.reduce((sum, stat) => sum + stat.count, 0)
        
        const getOrderStat = (status) => orderStats.find((stat) => stat._id === status) || { count: 0, totalAmount: 0 }

        const { count: cancelledOrders, totalAmount: cancelledAmount } = getOrderStat('Cancelled')
        const { count: pendingOrders, totalAmount: pendingAmount } = getOrderStat('Pending')
        const { count: processingOrders, totalAmount: processingAmount } = getOrderStat('Processing')
        const { count: deliveredOrders, totalAmount: deliveredAmount } = getOrderStat('Delivered')
        
        const financialStats = await Order.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: "$finalAmount" },
                    totalDiscounts: { $sum: "$discount" },
                }
            }
        ]);

        const totalSales = financialStats[0]?.totalSales || 0;
        const totalDiscounts = financialStats[0]?.totalDiscounts || 0;

       
        const activeCoupons = await Coupon.countDocuments({
            expireOn: { $gt: new Date() },
            isListed: true
        })

        const expiredCoupons = await Coupon.countDocuments({ expireOn: { $lt: new Date() } })
        
        const totalCouponUsage = await Order.countDocuments({
            ...dateFilter,
            discount: { $gt: 0 }
        })
        
        const totalUsers = await User.countDocuments()
        
        const percentage = (count) => (totalOrders ? ((count / totalOrders) * 100).toFixed(2) : 0)
        const cancelledPercentage = percentage(cancelledOrders)
        const pendingPercentage = percentage(pendingOrders)
        const processingPercentage = percentage(processingOrders)
        const deliveredPercentage = percentage(deliveredOrders)
        
        const totalSalesGrowth = 5.2
        
        const topProducts = await Order.aggregate([
            { $unwind: "$orderItems" }, 
            {
                $lookup: {
                    from: "products",
                    localField: "orderItems.productId",
                    foreignField: "_id",
                    as: "productInfo"
                }
            },
            { $unwind: "$productInfo" },
            {
                $group: {
                    _id: "$orderItems.productId",
                    productName: { $first: "$productInfo.productName" },
                    category: { $first: "$productInfo.category" },
                    totalQuantitySold: { $sum: "$orderItems.quantity" },
                    totalRevenue: { $sum: { $multiply: ["$orderItems.quantity", "$orderItems.price"] } },
                    orderCount: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: "categories",
                    localField: "category",
                    foreignField: "_id",
                    as: "categoryInfo"
                }
            },
            { $unwind: "$categoryInfo" },
            { $sort: { totalQuantitySold: -1 } },
            { $limit: 10 }
        ])

    
        const topCategories = await Order.aggregate([
            { $unwind: "$orderItems" }, 
            {
                $lookup: {
                    from: "products",
                    localField: "orderItems.productId",
                    foreignField: "_id",
                    as: "productInfo"
                }
            },
            { $unwind: "$productInfo" },
            {
                $group: {
                    _id: "$productInfo.category",
                    totalRevenue: { $sum: { $multiply: ["$orderItems.quantity", "$orderItems.price"] } },
                    totalQuantitySold: { $sum: "$orderItems.quantity" }
                }
            },
            {
                $lookup: {
                    from: "categories", // Ensure collection name matches your DB
                    localField: "_id",
                    foreignField: "_id",
                    as: "categoryInfo"
                }
            },
            { $unwind: "$categoryInfo" },
            { $sort: { totalRevenue: -1 } }, // Sorting by revenue (highest first)
            { $limit: 10 } // Now fetching top 10 instead of 5
        ]);
        

        const topBrands = await Order.aggregate([
            { $unwind: "$orderItems" }, 
            {
                $lookup: {
                    from: "products",
                    localField: "orderItems.productId",
                    foreignField: "_id",
                    as: "productInfo"
                }
            },
            { $unwind: "$productInfo" },
            {
                $group: {
                    _id: "$productInfo.brand", 
                    totalRevenue: { $sum: { $multiply: ["$orderItems.quantity", "$orderItems.price"] } },
                    totalQuantitySold: { $sum: "$orderItems.quantity" }
                }
            },
            {
                $lookup: {
                    from: "brands",
                    localField: "_id", 
                    foreignField: "brandName", 
                    as: "brandInfo"
                }
            },
            { $unwind: { path: "$brandInfo", preserveNullAndEmptyArrays: true } }, 
            { $sort: { totalRevenue: -1 } },
            { $limit: 10 },
            {
                $project: {
                    _id: 0,
                    brandName: "$_id",
                    totalRevenue: 1,
                    totalQuantitySold: 1,
                    brandImage: { $arrayElemAt: ["$brandInfo.brandImage", 0] } 
                }
            }
        ]);
        
        console.log("Top Brands:", topBrands);
        

        res.render('dashboard', {
            data: {
                totalSales,
                totalSalesGrowth,
                totalOrders,
                cancelledOrders,
                cancelledAmount,
                cancelledPercentage,
                pendingOrders,
                pendingAmount,
                pendingPercentage,
                processingOrders,
                processingAmount,
                processingPercentage,
                deliveredOrders,
                deliveredAmount,
                deliveredPercentage,
                totalUsers,
                totalDiscounts,
                activeCoupons,
                expiredCoupons,
                totalCouponUsage,
                discountPercentage: totalSales ? ((totalDiscounts / totalSales) * 100).toFixed(2) : 0,
                selectedPeriod: period
            },
            topProducts,
            topCategories,
            topBrands
        });

    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        res.status(500).send("Internal Server Error");
    }
};


const logout = async(req,res)=>{
    try {
        req.session.admin = undefined
        return res.redirect("/admin/login")

    } catch (error) {
        console.log("Error in logout: ",error)
        res.redirect("/admin/pageError")
        
    }
}

module.exports = {
    pageError,
    loadLogin,
    login,
    loadDashboard,
    logout
}