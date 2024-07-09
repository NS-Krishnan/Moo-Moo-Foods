const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 30000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const dbURI = process.env.MONGODB_URI || "mongodb://localhost:27017/krishnandatabase";
mongoose.connect(dbURI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

// Define Item Model
const itemSchema = mongoose.Schema({
  name: String,
  price: Number,
  category: String,
  photo: String,
});

const Item = mongoose.model('Item', itemSchema);

// Define User Model
const userSchema = mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  postCode: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
}, {versionkey: false

});

const User = mongoose.model('User', userSchema);
const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  items: [
    {
      name: { type: String, required: true },
      price: { type: Number, required: true },
      qty: { type: Number, required: true },
    },
  ],
  totalPrice: { type: Number, required: true },
  orderDate: { type: Date, default: Date.now },
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
// Define Cart Model
const cartSchema = mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Reference the User model
      required: true
    },
    items: [
      {
        itemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Item', // Reference the Item model
          required: true
        },
        qty: Number,
      }
    ],
    ordered: Boolean,
  });

const Cart = mongoose.model('Cart', cartSchema);

// Routes
app.get('/', (req, res) => {
    res.send('Hello from Express!');
});
app.post('/createOrder', async (req, res) => {
  try {
    const { userId, items, totalPrice } = req.body;

    const newOrder = new Order({
      userId,
      items,
      totalPrice,
    });

    const savedOrder = await newOrder.save();

    // Clear the cart
    await clearCartItems(userId);

    res.status(200).json(savedOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Helper function to clear cart items
const clearCartItems = async (userId) => {
  try {
    // Implement the logic to clear cart items for the given userId
    // For example, if you have a Cart model, you can call Cart.deleteMany({ userId })
    console.log(`Cart items cleared for user: ${userId}`);
  } catch (error) {
    console.error(`Error clearing cart items for user ${userId}:`, error);
  }
};
//fetch from cart
app.get('/cart/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        if (!mongoose.isValidObjectId(userId)) {
            return res.status(400).json({ message: 'Invalid userId' });
        }
        
        const cart = await Cart.findOne({ userId }).populate('items.itemId');
        if (cart) {
            // Accessing populated items array
            const populatedItems = cart.items.map(item => ({
                // Accessing properties of the populated itemId object
                name: item.itemId.name,
                price: item.itemId.price,
                category: item.itemId.category,
                photo: item.itemId.photo,
                qty: item.qty,
                _id: item._id,
            }));
            res.status(200).json(populatedItems);
           // console.log(cart)
        } else {
            res.status(404).json({ message: 'Cart not found' });
        }
    } catch (error) {
        console.error('Error fetching cart items:', error);
        res.status(500).json({ message: 'Server error' });
    }
    
});



app.post('/add-to-cart', async (req, res) => {
    const { userId, itemId } = req.body;
  
    try {
        let cart = await Cart.findOne({ userId });
    
        // If cart doesn't exist, create a new one
        if (!cart) {
            cart = new Cart({
                userId,
                items: [{ itemId, qty: 1 }],
                ordered: false,
            });
            await cart.save();
            return res.status(201).json(cart);
        }
    
        // If cart exists, check if the item is already in the cart
        const existingItemIndex = cart.items.findIndex(item => item.itemId.toString() === itemId);
    
        if (existingItemIndex !== -1) {
            // If the item exists, increment its quantity
            cart.items[existingItemIndex].qty += 1;
        } else {
            // If the item doesn't exist, add it to the cart
            cart.items.push({ itemId, qty: 1 });
        }
    
        await cart.save();
        // Fetch updated cart to include populated item details
        cart = await Cart.findById(cart._id).populate('items.itemId');
        res.json(cart);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
});


// Update cart quantity for a user
app.put('/updateCartItem/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { itemName, qty } = req.body;
  
      //console.log('Request received:', req.body); // Debug: Log the request body
  
      // Find the cart for the specified user
      const cart = await Cart.findOne({ userId }).populate('items.itemId');
  
      if (!cart) {
        //console.error(`Error: Cart not found for user ${userId}`); // Debug: Log error message
        return res.status(404).json({ error: 'Cart not found' });
      }
  
      //console.log('Cart found:', cart); // Debug: Log the found cart
  
      // Find the item in the cart based on the item name
      const itemToUpdate = cart.items.find(item => item.itemId.name === itemName);
  
      if (!itemToUpdate) {
        // Item not found in the cart
        //console.error(`Error: Item "${itemName}" not found in cart for user ${userId}`); // Debug: Log error message
        return res.status(404).json({ error: 'Item not found in the cart' });
      }
  
      //console.log(`Updating quantity of item "${itemName}" to ${qty}`); // Debug: Log quantity update
  
      // Update the quantity of the item
      itemToUpdate.qty = qty;
  
      // Save the updated cart
      await cart.save();
  
      //console.log('Cart updated successfully'); // Debug: Log success message
  
      res.status(200).json({ message: 'Item quantity updated successfully' });
    } catch (error) {
      console.error('Error updating item quantity:', error);
      res.status(500).json({ error: 'An error occurred while updating item quantity' });
    }
});
  
app.delete('/deleteCartItem/:userId/', async (req, res) => {
  try {
    const { userId } = req.params;
      const { itemName} = req.body;

    // Find the cart for the specified user
    const cart = await Cart.findOne({ userId }).populate('items.itemId');

    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    // Find the index of the item to be deleted
    const itemIndex = cart.items.findIndex(item => item.itemId.name === itemName);

    if (itemIndex === -1) {
      return res.status(404).json({ error: `Item "${itemName}" not found in cart` });
    }

    // Remove the item from the cart
    cart.items.splice(itemIndex, 1);

    // Save the updated cart
    await cart.save();

    res.status(200).json({ message: `Item "${itemName}" deleted successfully` });
  } catch (error) {
    console.error('Error deleting item from cart:', error);
    res.status(500).json({ error: 'An error occurred while deleting item from cart' });
  }
});



// Clear cart for a user
app.delete('/clearCart/:userId', async (req, res) => {
    try {
      const userId = req.params.userId;
      const cart = await Cart.findOne({ userId });
  
      if (!cart) {
        return res.status(404).json({ message: 'Cart not found' });
      }
  
      cart.items = []; // Clear the items array
      cart.ordered = false; // Set ordered to false
      await cart.save();
  
      res.status(200).json({ message: 'Cart cleared successfully' });
    } catch (error) {
      console.error('Error clearing cart:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });


// Fetch items
app.get('/items', async (req, res) => {
    const start = parseInt(req.query.start) || 0;
    const limit = parseInt (req.query.limit) || 8;
    const category = req.query.category || ''; // Adding category filtering
    try {
        const items = await Item.find({ category: new RegExp(category, 'i') }).skip(start).limit(limit);
        res.json(items);
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).json({ message: 'Error fetching items' });
    }
});

// Fetch cart
const { ObjectId } = mongoose.Types;

app.get('/cart/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        const cart = await Cart.findOne({ userId: new ObjectId(userId) });
        if (cart) {
            // Validate all item IDs
            const validItems = cart.items.filter(item => ObjectId.isValid(item.itemId));
            const items = await Item.find({
                _id: { $in: validItems.map(item => new ObjectId(item.itemId)) }
            });
            const responseItems = items.map(item => {
                const cartItem = cart.items.find(cartItem => cartItem.itemId === item._id.toString());
                return {
                    name: item.name,
                    price: item.price,
                    category: item.category,
                    photo: item.photo,
                    quantity: cartItem ? cartItem.qty : 0,
                };
            });
            res.status(200).json(responseItems);
        } else {
            res.status(200).json([]);
        }
    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).json({ message: 'Error fetching cart' });
    }
});



// Clear items

// Update item quantity in cart



// User login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email, password }); // Query the database to find the user
        if (user) {
            // If user exists, send success response
            res.status(200).json({ message: 'Login successful', user });
        } else {
            // If user doesn't exist, send unauthorized response
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        // If any error occurs, send internal server error response
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// User signup
app.post('/signup', async (req, res) => {
    const { email, password, name, postCode, address } = req.body;
    try {
        const newUser = new User({ email, password, name, postCode, address });
        await newUser.save();

        let userObj = newUser.toObject();
        delete userObj.__v;

        res.status(201).json(userObj);
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Error during signup' });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));