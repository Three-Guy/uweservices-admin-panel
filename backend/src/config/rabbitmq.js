const amqp = require('amqplib');
const logger = require('../utils/logger');

let channel = null;
let connection = null;
let isConnecting = false;

const connectRabbitMQ = async (io) => {
  if (isConnecting) {
    logger.info('RabbitMQ connection already in progress...');
    return;
  }

  isConnecting = true;

  try {
    const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672';
    
    logger.info('Attempting to connect to RabbitMQ...');
    logger.info('Using URL:', rabbitmqUrl.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'));
    
    try {
      // Connect to RabbitMQ
      connection = await amqp.connect(rabbitmqUrl, {
        heartbeat: 60,
      });
      
      logger.info('✓ RabbitMQ Connection Established');
      
      // Create channel
      channel = await connection.createChannel();
      await channel.prefetch(1);
      
      logger.info('✓ RabbitMQ Channel Created');
      
      const exchange = process.env.RABBITMQ_EXCHANGE || 'marketplace_events';
      
      // Assert exchange
      await channel.assertExchange(exchange, 'topic', { 
        durable: true 
      });
      
      logger.info(`✓ Exchange '${exchange}' ready`);
      
      // Queue for admin notifications
      const adminQueue = 'admin_notifications';
      const queueOptions = { 
        durable: true,
        arguments: {
          'x-message-ttl': 86400000, // 24 hours
        }
      };
      
      await channel.assertQueue(adminQueue, queueOptions);
      await channel.bindQueue(adminQueue, exchange, 'provider.#');
      await channel.bindQueue(adminQueue, exchange, 'booking.#');
      await channel.bindQueue(adminQueue, exchange, 'payment.#');
      
      logger.info(`✓ Queue '${adminQueue}' bound to exchange`);
      
      // Consume messages
      channel.consume(adminQueue, (msg) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            const routingKey = msg.fields.routingKey;
            
            logger.info('Received message:', {
              routingKey,
              content: content
            });
            
            // Emit to connected admins via Socket.IO
            if (io) {
              io.emit('notification', {
                type: routingKey,
                data: content,
                timestamp: new Date().toISOString()
              });
            }
            
            channel.ack(msg);
          } catch (error) {
            logger.error('Error processing message:', error);
            channel.nack(msg, false, false); // Don't requeue
          }
        }
      }, { noAck: false });
      
      logger.info('✓ RabbitMQ Message Consumer Started');
      logger.info('✓ RabbitMQ fully operational');
      
      // Connection error handler
      connection.on('error', (err) => {
        logger.error('RabbitMQ connection error:', err.message);
      });
      
      // Connection close handler
      connection.on('close', () => {
        logger.warn('RabbitMQ connection closed, attempting to reconnect in 5s...');
        channel = null;
        connection = null;
        isConnecting = false;
        setTimeout(() => connectRabbitMQ(io), 5000);
      });
      
      // Channel error handler
      channel.on('error', (err) => {
        logger.error('RabbitMQ channel error:', err.message);
      });
      
      // Channel close handler
      channel.on('close', () => {
        logger.warn('RabbitMQ channel closed');
      });
      
      isConnecting = false;
      
    } catch (error) {
      isConnecting = false;
      
      if (error.code === 'ECONNREFUSED') {
        logger.warn('⚠ RabbitMQ not available - running without message queue');
        logger.warn('To enable RabbitMQ:');
        logger.warn('1. Run: docker-compose up -d rabbitmq');
        logger.warn('2. Check: docker-compose logs rabbitmq');
        logger.warn('3. Management UI: http://localhost:15672');
      } else {
        logger.error('RabbitMQ connection error:', error.message);
        logger.warn('Retrying connection in 10 seconds...');
        setTimeout(() => connectRabbitMQ(io), 10000);
      }
    }
    
  } catch (error) {
    isConnecting = false;
    logger.error('RabbitMQ setup error:', error);
  }
};

const publishMessage = async (routingKey, message) => {
  if (!channel) {
    logger.warn('RabbitMQ channel not available, message not sent:', routingKey);
    return false;
  }
  
  try {
    const exchange = process.env.RABBITMQ_EXCHANGE || 'marketplace_events';
    
    const messageBuffer = Buffer.from(JSON.stringify({
      ...message,
      timestamp: new Date().toISOString(),
      source: 'admin-panel'
    }));
    
    const published = channel.publish(
      exchange,
      routingKey,
      messageBuffer,
      { 
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now()
      }
    );
    
    if (published) {
      logger.info(`Message published: ${routingKey}`);
      return true;
    } else {
      logger.warn(`Failed to publish message: ${routingKey}`);
      return false;
    }
  } catch (error) {
    logger.error('Error publishing message:', error);
    return false;
  }
};

const getChannel = () => {
  return channel;
};

const closeConnection = async () => {
  try {
    if (channel) {
      await channel.close();
      logger.info('RabbitMQ channel closed');
    }
    if (connection) {
      await connection.close();
      logger.info('RabbitMQ connection closed');
    }
  } catch (error) {
    logger.error('Error closing RabbitMQ connection:', error);
  }
};

module.exports = connectRabbitMQ;
module.exports.publishMessage = publishMessage;
module.exports.getChannel = getChannel;
module.exports.closeConnection = closeConnection;