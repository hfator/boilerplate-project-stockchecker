const axios = require('axios');
const bcrypt = require('bcrypt');

module.exports = function (app, stockLikesCollection) {
  const fixedSalt = process.env.SALT;

  const fetchStockPrice = async (stock) => {
    try {
      const response = await axios.get(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stock}/quote`);
      return {
        stock: response.data.symbol,
        price: response.data.latestPrice
      };
    } catch (error) {
      console.error('Error fetching stock price:', error);
      return null;
    }
  };

  const anonymiseIP = async (ip) => {
    return bcrypt.hash(ip, fixedSalt);
  };

  app.route('/api/stock-prices')
    .get(async function (req, res) {
      const stock = req.query.stock;
      const like = req.query.like === 'true';
      const clientIP = req.ip;

      const stocks = Array.isArray(stock) ? stock : [stock];

      let stockDataPromises = stocks.map(async (stk) => {
        let stockData = await fetchStockPrice(stk.toUpperCase());
        if (!stockData) return null;

        if (like) {
          const anonymisedIP = await anonymiseIP(clientIP);
          const existingLike = await stockLikesCollection.findOne({ stock: stockData.stock, ip: anonymisedIP });

          if (!existingLike) {
            await stockLikesCollection.insertOne({ stock: stockData.stock, ip: anonymisedIP });
          }
        }
        stockData.likes = await stockLikesCollection.countDocuments({ stock: stockData.stock });
        return stockData;
      });

      try {
        let stockDataArray = await Promise.all(stockDataPromises);
        stockDataArray = stockDataArray.filter(data => data);

        if (stockDataArray.length === 1) {
          res.json({ stockData: stockDataArray[0] });
        } else if (stockDataArray.length === 2) {
          const relLikes1 = stockDataArray[0].likes - stockDataArray[1].likes;
          const relLikes2 = stockDataArray[1].likes - stockDataArray[0].likes;

          res.json({
            stockData: [
              {
                stock: stockDataArray[0].stock,
                price: stockDataArray[0].price,
                rel_likes: relLikes1
              },
              {
                stock: stockDataArray[1].stock,
                price: stockDataArray[1].price,
                rel_likes: relLikes2
              }
            ]
          });
        }
      } catch (error) {
        console.error('Error processing stock data:', error);
        res.status(500).json({ error: 'Error fetching stock data' });
      }
    });

};
