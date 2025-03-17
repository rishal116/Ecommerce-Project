const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const mongodb = require("mongodb");
const Cart = require("../../models/cartSchema")
const mongoose = require("mongoose");
const Wishlist = require("../../models/wishlistSchema");

const getCartPage = async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      return res.redirect('/');
    }

    const userId = req.session.user;
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    let cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart) {
      cart = new Cart({
        userId,
        items: []
      });
    }

 
    cart.items = cart.items.filter(item => item.productId && !item.productId.isBlocked);

    const totalItems = cart.items.length;
    const totalPages = Math.ceil(totalItems / limit);
    const paginatedItems = cart.items.slice(skip, skip + limit);
    cart.items = paginatedItems;

 
    let subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let total = subtotal; 

    cart.subtotal = subtotal;
    cart.total = total;

    const userData = await User.findById(userId);

    res.render('cart', {
      cart: cart,
      user: userData,
      currentPage: page,
      totalPages
    });

  } catch (error) {
    console.error('Error while loading the cart page', error);
    res.redirect('/pageNotFound');
  }
};



const addToCart = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized. Please log in.' });
    }

    const { productId, productPrice, selectedSize} = req.body; 
    console.log("body: ",req.body)


    const parsedPrice = parseInt(productPrice);

    if (isNaN(parsedPrice)) {
      return res.status(400).json({ message: 'Invalid product price.' });
    }

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    if (!selectedSize) { 
      return res.status(400).json({ message: 'Size selection is required' });
    }

    const product = await Product.findById(productId).populate('category');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (!product.category?.isListed) {
      return res.status(403).json({ message: 'This product category is unlisted.' });
    }

    const sizeIndex = product.sizes.findIndex(size => size.size === selectedSize);

    if (sizeIndex === -1 || product.sizes[sizeIndex].quantity <= 0) {
      return res.status(400).json({ message: 'Selected size is out of stock.' });
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const existingItem = cart.items.find(item => 
      item.productId.toString() === productId && item.selectedSize === selectedSize
    )


    if (existingItem) {
      if(existingItem.quantity > 4){
        return res.status(400).json({ message: 'Maximum of 5 items per size allowed.' });
      }
      if (existingItem.quantity + 1 > product.sizes[sizeIndex].quantity) {
        return res.status(400).json({ message: 'Not enough stock available.' });
      }
      existingItem.quantity += 1;
      existingItem.totalPrice = existingItem.quantity * existingItem.price;
    } else {
      cart.items.push({
        productId,
        selectedSize,
        price: parsedPrice,
        totalPrice: parsedPrice,
        quantity: 1,
        status: 'Placed'
      });
    }

    await product.save();
    await cart.save();

    const wishlist = await Wishlist.findOne({ userId });

if (wishlist) {
  const result = await Wishlist.updateOne(
    { userId: userId },
    { $pull: { products: { productId: productId } } }
  )
}

await User.findByIdAndUpdate(
  userId,
  { $pull: { wishlist: productId } }, 
  { new: true } 
);



    await User.findByIdAndUpdate(userId, {
      $push: { cart: cart._id },
    });

    res.status(201).json({
      message: 'Successfully added to cart',
      cart: cart.toObject()
    });

  } catch (error) {
    console.error('Error while adding product to cart:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const changeQuantity = async (req, res) => {
  try {
    const { itemId, quantity, size } = req.body
    const userId = req.session.user
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized. Please log in.' })
    }
    
    const parsedQuantity = parseInt(quantity, 10)
    if (!itemId || !size || isNaN(parsedQuantity) || parsedQuantity < 1) {
      return res.status(400).json({ message: 'Invalid item, size, or quantity' })
    }
    
    let cart = await Cart.findOne({ userId }).populate("items.productId")
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' })
    }
    
    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId)
    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in cart' })
    }
    
    const product = cart.items[itemIndex].productId
    if (!product) {
      return res.status(400).json({ message: "Product not found." })
    }
    
    if (!product.sizes || product.sizes.length === 0) {
      return res.status(400).json({ message: "Product size information is missing." })
    }

      const selectedSize = product.sizes.find(s => s.size === size);
      

      if (!selectedSize) {
       
          return res.status(400).json({ message: `Selected size '${size}' not available.` });
      }

      if (!Number.isInteger(selectedSize.quantity) || selectedSize.quantity < 0) {
              
          return res.status(400).json({ message: `Invalid stock quantity for size '${size}'.` });
      }

      if (parsedQuantity > selectedSize.quantity) {
        
        
          return res.status(400).json({ message: `Only ${selectedSize.quantity} items available for size '${size}'.` });
      }

      if (parsedQuantity > 5) {
        
          return res.status(400).json({ message: 'You can only add up to 5 items per product.' });
      }

      const salePrice = Number(product.salePrice);
      if (isNaN(salePrice) || salePrice < 0) {

     
        
          return res.status(400).json({ message: 'Invalid sale price for product.' });
      }

   
      cart.items[itemIndex].quantity = parsedQuantity;
      cart.items[itemIndex].size = size;
      cart.items[itemIndex].totalPrice = salePrice * parsedQuantity;

      if (!cart.items[itemIndex].totalPrice) {
        cart.items[itemIndex].totalPrice = 0; 
    }
    

      let subtotal = cart.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
      const TAX_RATE = 0.12;
      let tax = Number(((subtotal || 0) * TAX_RATE).toFixed(2));
      let total = Number(((subtotal || 0) + tax).toFixed(2));


      cart.subtotal = subtotal;
      cart.tax = tax;
      cart.total = total;

      await cart.save();

    
     return res.json({ message: 'Cart updated successfully' ,cart});

  } catch (error) {
      console.error('Error updating cart item:', error);
      res.status(500).json({ message: 'Internal Server Error' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { itemId } = req.body
    const id = req.session.user
    
    const cart = await Cart.findOne({ userId: id })
    if (!cart) {
      return res.status(404).send('Cart not found.')
    }
    
    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId)
    if (itemIndex === -1) {
      return res.status(404).send('Item not found in cart.')
    }
    
    cart.items.splice(itemIndex, 1)
    await cart.save()
    
    res.status(200).send('Item removed from cart successfully.')
  } catch (error) {
    console.error('Error removing item from cart:', error)
    res.status(500).send('Server error.')
  }
}

module.exports = {
  getCartPage,
  addToCart,
  changeQuantity,
  deleteProduct,
};
