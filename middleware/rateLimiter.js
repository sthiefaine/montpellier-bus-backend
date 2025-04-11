const rateLimit = require("express-rate-limit");

/**
 * Configuration du rate limiter pour les routes générales
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true, // Renvoie les en-têtes standard `RateLimit-*`
  legacyHeaders: false, // Désactive les en-têtes `X-RateLimit-*`
  message: {
    status: "error",
    message: "Trop de requêtes, veuillez réessayer plus tard.",
  },
  handler: (req, res, next, options) => {
    console.log(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json(options.message);
  },
});

/**
 * Configuration du rate limiter pour les routes sensibles
 * (ex: route d'authentification si ajoutée plus tard)
 */
const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Trop de tentatives, compte temporairement bloqué.",
  },
});

/**
 * Configuration du rate limiter moins restrictif
 * pour les routes de monitoring
 */
const healthLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  strictLimiter,
  healthLimiter,
};
