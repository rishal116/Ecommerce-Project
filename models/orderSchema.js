const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { Schema } = mongoose;

const orderSchema = new Schema({
  orderId: {
    type: String,
    default: () => uuidv4(),
    unique: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  orderItems: [
    {
      productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
      productName :{
        type:String,
        required:false
      },
      quantity: {
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        default: 0,
      },
      productImage:{
        type:[String],
        required:true,
      },
      selectedSize: {
        type: String,
        required: false
    },
    returnRequest: {
      status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
      },
      reason: {
        type: String,
        default: '',
      },
      requestDate: {
        type: Date,
        default: null,
      },
    },
  },
],
totalPrice: {
  type: Number,
  required: true,
},
discount: {
  type: Number,
  default: 0,
},
finalAmount: {
  type: Number,
  required: true,
},
address: {
  addressType: {
    type: String,
    required: true,
  },
    name: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    landMark: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    pincode: {
      type: Number,
      required: true,
    },
    phone: {
      type: Number,
      required: true,
    },
    altPhone: {
      type: Number,
      required: true,
    },
  },
  invoiceDate: {
    type: Date,
  },
  status: {
    type: String,
    required: true,
    enum: [
      'Pending',
      'Processing',
      'Shipped',
      'Delivered',
      'Cancelled',
      'payment pending',
      'Return Request',
      'Return Accepted',
      'Return Rejected',
    ],
  },
  cancellationReason: { 
    type: String,
    default: '',
  },
  createdOn: {
    type: Date,
    default: Date.now,
    required: true,
  },
  couponApplied: {
    type: Boolean,
    default: false,
  },
  paymentMethod: {
    type: String,
    required: true,
  },
  returnReason: {
    type: String,
  },
});

const Order = mongoose.model('Order', orderSchema)

module.exports = Order
