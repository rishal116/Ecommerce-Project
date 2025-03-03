const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const mongodb = require("mongodb");
const mongoose = require("mongoose");
const razorpay = require("razorpay");
const env = require("dotenv").config();
const crypto = require("crypto");
const moment = require("moment");
const fs = require("fs");
const path = require("path");
const easyinvoice = require("easyinvoice");
const Coupon = require("../../models/couponSchema");
let instance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
const PDFDocument = require('pdfkit');

const getCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user
        const userData = await User.findOne({ _id: userId })
        const cart = await Cart.findOne({ userId }).populate("items.productId")
        const userAddresses = await Address.find({ userId })

        let products = []
        let subtotal = 0
        let delivery = 88
        let discount = 0  
        let total = 0
        
        products = cart.items.map(item => ({
            productName: item.productId.productName,
            salePrice: item.productId.salePrice,
            quantity: item.quantity,
            productImage: item.productId.productImage[0],
            totalPrice: item.totalPrice
        }))

        subtotal = products.reduce((acc, product) => acc + (product.totalPrice || 0), 0)
        
        discount = (subtotal / 100) * 10
        total = subtotal + delivery
        
        res.render("checkout", {
            user: userData,
            addresses:userAddresses,
            products,
            subtotal,
            delivery,
            discount,
            total
        })
    } catch (error) {
        console.error("Error loading checkout page:", error)
        res.status(500).send("Internal Server Error")
    }
}

const loadPayment = async(req,res)=>{
    try {
        const id = req.query.id
        const userId = req.session.user
        const userData = await User.findOne({ _id: userId })
        const cartData = await Cart.findOne({ userId: userId }).populate("items.productId")
        if (!cartData) {
            return res.redirect("/checkout")
        }

        let products = []
        let subtotal = 0
        let delivery = 88  
        let discount = 0
        let total = 0
        let cashCollectionCharge = 50 

        if (Array.isArray(cartData.items)) {
            products = cartData.items.map(item => ({
                productId: item.productId._id,
                name: item.productId.productName,
                price: item.productId.salePrice,
                quantity: item.quantity,
                totalPrice: item.totalPrice
            }));

            subtotal = products.reduce((acc, product) => acc + (product.totalPrice || 0), 0)
            subtotal = subtotal + (subtotal / 100) * 12
        }

        discount = (subtotal / 100) * 10
        total = subtotal + delivery - discount

        const offerPrice = req.session.offerPrice || 0

        total = total - parseInt(offerPrice) 

        const userAddress = await Address.find({ userId: userData._id }, { address: true })

        const selectedAddress = userAddress[0].address.find((addr) => addr._id.toString() === id)
        
        res.render('payment', {
            user: userData,
            customerName: selectedAddress.name,
            deliveryType: "Standard", 
            itemCount: products.length,
            items: products,
            totalMRP: subtotal,
            bagDiscount: discount,
            subtotal,
            delivery,
            total,
            cashCollectionCharge,
            selectedAddressId: id,
            cartItems: products 

        })
    } catch (error) {
        console.log("error while loadPayment:",error)
        res.redirect("/pageNotFound")
    }
}

const orderPlaced = async (req, res) => {
    try {
        const userId = req.session.user;
        const { paymentMethod, addressId } = req.body
        const userCart = await Cart.findOne({ userId }).populate('items.productId');
        if (!userCart || userCart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }

        const user = await Address.findOne({ userId });
        if (!user || !user.address.id(addressId)) {
            return res.status(404).json({ success: false, message: "Address not found" });
        }

        const selectedAddress = user.address.id(addressId)
        if (!selectedAddress) {
            return res.status(400).json({ error: "Address not found" })
        }

   
        const orderedItems = userCart.items.map(item => ({
            productId: item.productId._id, 
            productName:item.productId.productName,
            selectedSize:item.selectedSize,
            quantity: item.quantity,
            price: item.price,
            productImage: item.productId.productImage
        }));

        let totalPrice = orderedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
        const deliveryCharge = 88;
        const discount = req.session.offerPrice || 0
        let finalAmount = totalPrice + deliveryCharge - parseInt(discount)


   
        const newOrder = new Order({
            userId,
            orderItems: orderedItems,
            totalPrice,
            discount,
            finalAmount,
            deliveryCharge,
            address: selectedAddress,
            paymentMethod,
            status: "Pending",
            couponApplied: discount > 0
        })


        await newOrder.save()
        req.session.offerPrice = null

        for (const item of orderedItems) {
            await Product.updateOne(
                { _id: item.productId ,"sizes.size": item.selectedSize},
                { $inc: { "sizes.$.quantity": -item.quantity } },
            )
        }
        
        await Cart.findOneAndUpdate(
            { userId },
            { $set: { items: [] } }
        )

        req.session.orderId = newOrder._id

        return res.json({ success: true, message: "Order placed successfully", orderId: newOrder._id })

    } catch (error) {
        console.log("Error while placing order:", error)
        res.status(500).json({ success: false, message: "Server error" })
    }
}


const orderConformed = async(req,res)=>{
    try {
        
        const orderId = req.session.orderId;
        const userId = req.session.user
        const userData = await User.findOne({ _id: userId})
        

        if (!orderId) {
            return res.redirect('/pageNotFound');
        }

        const order = await Order.findById( orderId ).populate('orderItems.productId');

        if (!order) {
            return res.redirect('/pageNotFound');
        }

        res.render('order-conformed', { order, user: userData });

    } catch (error) {
        
        console.log('Error while loading the order success page!', error);
        res.redirect('/pageNotFound')

    }

}

const generatePDF = async (req, res) => {
    try {
        const { orderId, customerDetails, orderItems, totalAmount } = req.body;

        if (!orderId || !customerDetails || !orderItems || !totalAmount) {
            return res.status(400).json({ success: false, message: "Missing order details" });
        }

        const doc = new PDFDocument();
        const fileName = `invoice-${orderId}.pdf`;
        const filePath = path.join(__dirname, '../public/invoices', fileName);

        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);

        doc.fontSize(20).text('Invoice', { align: 'center' }).moveDown(2);

        // Parse JSON safely
        const customer = typeof customerDetails === 'string' ? JSON.parse(customerDetails) : customerDetails;
        doc.fontSize(14).text(`Order ID: ${orderId}`).moveDown(0.5);
        doc.text(`Customer Name: ${customer.name}`);
        doc.text(`Email: ${customer.email}`);
        doc.text(`Address: ${customer.address}`).moveDown(1);

        doc.fontSize(16).text('Order Items:', { underline: true }).moveDown(0.5);
        
        const items = typeof orderItems === 'string' ? JSON.parse(orderItems) : orderItems;
        items.forEach((item, index) => {
            doc.fontSize(14).text(`${index + 1}. ${item.productName} - ${item.quantity} x $${item.price}`);
        });

        doc.moveDown(1);
        doc.fontSize(16).text(`Total Amount: $${totalAmount}`, { bold: true });

        doc.end();

        writeStream.on('finish', () => {
            res.download(filePath, fileName, (err) => {
                if (err) {
                    console.error('Error sending file:', err);
                    return res.status(500).json({ success: false, message: "Error downloading PDF" });
                }

                setTimeout(() => fs.unlinkSync(filePath), 60000);
            });
        });

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ success: false, message: "Server error while generating PDF" });
    }
};



const loadOrders = async (req, res) => {
    try {
        const userId = req.session.user;


        const userData = await User.findOne({ _id: userId });

        const orders = await Order.find({ userId })
            .populate({
                path: 'orderItems.productId',
                model: 'Product',
                select: 'productName productImage salePrice '
            })
            .lean();

    
        const formattedOrders = orders.map(order => ({
            orderId: order.orderId,
            orderNumber: order._id.toString().slice(-6),
            orderDate: order.createdOn.toISOString().split('T')[0],
            totalAmount: order.totalPrice,
            finalAmount: order.finalAmount,
            status: order.status,
            paymentMethod: order.paymentMethod,
            couponApplied: order.couponApplied,
            products: order.orderItems
                ?.filter(item => item.productId) 
                .map(item => ({
                    id: item.productId?._id?.toString() || 'N/A',
                    name: item.productId?.productName || 'Unknown Product',
                    image: item.productId?.productImage?.[0] || 'default-image.jpg',
                    quantity: item.quantity,
                    selectedSize:item.selectedSize,
                    price: item.price
                })) || [],
            address: order.address
                ? `${order.address.city}, ${order.address.state}, ${order.address.pincode}`
                : 'N/A'
        }));

    

        res.render('my-orders', { orders: formattedOrders, user: userData });

    } catch (error) {
        console.error('Error while loading the order page:', error);
        res.redirect('/pageNotFound');
    }
};

const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findOne({ orderId }).populate('userId');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

  
        const doc = new PDFDocument({ margin: 50 });
        const filePath = path.join(__dirname, `invoices/invoice-${orderId}.pdf`);
        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);

       
        doc.fontSize(22).text('Tready Threads', { align: 'center', underline: true });
        doc.moveDown();
        doc.fontSize(18).text('INVOICE', { align: 'center' });
        doc.moveDown();

      
        doc.fontSize(12).text(`Order ID: ${order.orderId}`);
        doc.text(`Invoice Date: ${new Date().toDateString()}`);
        doc.text(`Customer: ${order.userId.name} (${order.userId.email})`);
        doc.moveDown();
        doc.moveDown();

      
        doc.fontSize(14).text('Shipping Address', { underline: true });
        doc.fontSize(12).text(`${order.address.name}`);
        doc.text(`${order.address.city}, ${order.address.state}, ${order.address.pincode}`);
        doc.text(`Phone: ${order.address.phone}`);
        doc.moveDown();

       
        doc.fontSize(14).text('Order Items', { underline: true });
        doc.moveDown();
        doc.fontSize(12);
        doc.text('Product Name', 50, doc.y, { bold: true });
        doc.text('Qty', 350, doc.y, { bold: true });
        doc.text('Price', 450, doc.y, { bold: true });
        doc.moveDown();

        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();

        order.orderItems.forEach((item) => {
            doc.text(`${item.productName}`, 50);
            doc.text(`${item.quantity}`, 350);
            doc.text(`₹${item.price.toFixed(2)}`, 450);
            doc.moveDown();
        });

        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();


    doc.moveDown();
    doc.fontSize(14).text('Order Summary', { align: 'center', underline: true });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`Total Price: ₹${order.totalPrice.toFixed(2)}`, { align: 'center' });
    doc.text(`Discount: ₹${order.discount.toFixed(2)}`, { align: 'center' });
    doc.fontSize(14).text(`Final Amount: ₹${order.finalAmount.toFixed(2)}`, { align: 'center', bold: true });
    doc.moveDown();
    doc.fontSize(12).text(`Payment Method: ${order.paymentMethod}`, { align: 'center' });

    doc.moveDown();
    doc.fontSize(14).text(`Order Status: ${order.status}`, { align: 'center', bold: true });

    doc.moveDown();
    doc.fontSize(12).text('Thank you for shopping with us!', { align: 'center' });


        doc.end();

        writeStream.on('finish', () => {
            res.download(filePath, `invoice-${orderId}.pdf`, (err) => {
                if (err) console.error(err);
                fs.unlinkSync(filePath); // Delete file after download
            });
        });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};


const loadOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        
        const order = await Order.findOne({ orderId })
            .populate({
                path: 'orderItems.productId',
                model: 'Product',
                select: 'name price image',
            })
            .populate({
                path: 'userId',
                model: 'User',
                select: 'email',
            })
            .lean();

        if (!order) {
            return res.redirect('/pageNotFound');
        }

        const formattedOrder = {
            orderId: order.orderId,
            orderNumber: order._id.toString().slice(-6).toUpperCase(),
            orderDate: order.createdOn.toLocaleDateString(),
            confirmationDate: order.status !== 'Pending' ? order.createdOn.toLocaleDateString() : null,
            completionDate: order.status === 'Completed' ? order.invoiceDate?.toLocaleDateString() : null,
            cancellationDate: order.status === 'Cancelled' ? order.invoiceDate?.toLocaleDateString() : null,
            status: order.status,
            paymentMethod: order.paymentMethod,
            shippingMethod: 'Standard Delivery',
            email: order.userId?.email || 'N/A',
            address: order.address
                ? `${order.address.name}, ${order.address.city}, ${order.address.state}, ${order.address.pincode}`
                : 'Address not available',
            totalAmount: order.totalPrice,
            shippingCost: 5,
            discount: order.discount,
            finalAmount: order.finalAmount,
            products: order.orderItems.map(item => ({
                name: item.productId.name,
                price: item.price,
                quantity: item.quantity,
            })),
        };

        res.render('orderDetails', { order: formattedOrder });

    } catch (error) {
        console.error('Error while loading the order detail page:', error);
        res.redirect('/pageNotFound');
    }
};

const orderCancel = async (req, res) => {
    try {
        const orderId = req.params.id
        const order = await Order.findOne({ orderId: orderId })

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        for (const item of order.orderItems) {
            await Product.updateOne(
                { _id: item.productId, "sizes.size": item.selectedSize },
                { $inc: { "sizes.$.quantity": item.quantity } } 
            );
        }

        await Order.findOneAndDelete({ orderId: orderId });

        res.json({ success: true, message: 'Order cancelled and stock updated successfully' });

    } catch (error) {
        console.error('Error while cancelling the order:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }

};
module.exports = {
  getCheckoutPage,
  loadPayment,
  orderPlaced,
  orderConformed,
  generatePDF,
  loadOrders,
  downloadInvoice,
  loadOrderDetails,
  orderCancel,
};
