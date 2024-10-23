const { default: axios } = require("axios");

async function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.sendStatus(401);

  try {
    // Validate token by making a request to the PHP backend
    const response = await axios.get("http://13.61.33.202/api/validate-token", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 200) {
      req.user = response.data.user;
      next();
    } else {
      res.sendStatus(response.status);
    }
  } catch (error) {
    console.log(error.message);
    res.sendStatus(403);
  }
}

module.exports = { authenticateToken };
