const mongoose = require('mongoose');

const uri = 'mongodb+srv://trimbakeshwarboys_db_user:Threeguy%402804@finalapp.wv7bawf.mongodb.net/provider_db?retryWrites=true&w=majority';

async function testConnection() {
  try {
    console.log('Testing MongoDB Atlas connection...');
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✓ Successfully connected to MongoDB Atlas!');
    console.log('✓ Database:', mongoose.connection.name);
    await mongoose.connection.close();
    console.log('✓ Connection closed');
  } catch (error) {
    console.error('✗ Connection failed:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n🔧 DNS Issue - Try changing DNS to 8.8.8.8');
    }
    if (error.message.includes('authentication failed')) {
      console.error('\n🔧 Wrong username or password');
    }
    if (error.message.includes('IP') || error.message.includes('whitelist')) {
      console.error('\n🔧 Add your IP to Network Access in MongoDB Atlas');
    }
  }
}

testConnection();