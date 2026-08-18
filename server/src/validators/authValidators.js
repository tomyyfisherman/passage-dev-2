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

const updateProfileValidators = [
  body('name')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 }).withMessage('Le nom ne doit pas dépasser 100 caractères.'),
];

const deleteAccountValidators = [
  body('password')
    .isString()
    .notEmpty().withMessage('Le mot de passe est requis pour confirmer la suppression.'),
];

module.exports = {
  registerValidators,
  loginValidators,
  updateProfileValidators,
  deleteAccountValidators,
};
