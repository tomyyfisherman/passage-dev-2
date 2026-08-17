const { body } = require('express-validator');

const registerValidators = [
  body('email')
    .trim()
    .notEmpty().withMessage('L\'email est requis.')
    .isEmail().withMessage('Format d\'email invalide.')
    .normalizeEmail(),
  body('password')
    .isString()
    .isLength({ min: 8, max: 72 }).withMessage('Le mot de passe doit contenir entre 8 et 72 caractères.'),
];

const loginValidators = [
  body('email')
    .trim()
    .notEmpty().withMessage('L\'email est requis.')
    .isEmail().withMessage('Format d\'email invalide.')
    .normalizeEmail(),
  body('password')
    .isString()
    .notEmpty().withMessage('Le mot de passe est requis.'),
];

module.exports = { registerValidators, loginValidators };
