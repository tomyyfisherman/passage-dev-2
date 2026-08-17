const { body, param, query } = require('express-validator');

const STATUSES = ['todo', 'in_progress', 'done'];

const idParamValidator = [
  param('id').isInt({ min: 1 }).withMessage('Identifiant invalide.').toInt(),
];

const listQueryValidators = [
  query('status')
    .optional()
    .isIn(STATUSES).withMessage(`Le statut doit etre l'un de : ${STATUSES.join(', ')}.`),
];

const createTaskValidators = [
  body('title')
    .trim()
    .notEmpty().withMessage('Le titre est requis.')
    .isLength({ max: 200 }).withMessage('Le titre ne doit pas depasser 200 caracteres.'),
  body('description')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 2000 }).withMessage('La description ne doit pas depasser 2000 caracteres.'),
  body('status')
    .optional()
    .isIn(STATUSES).withMessage(`Le statut doit etre l'un de : ${STATUSES.join(', ')}.`),
  body('due_date')
    .optional({ checkFalsy: true })
    .isISO8601().withMessage('La date d\'echeance doit etre une date valide (AAAA-MM-JJ).')
    .toDate(),
];

const updateTaskValidators = [
  ...idParamValidator,
  body('title')
    .optional()
    .trim()
    .notEmpty().withMessage('Le titre ne peut pas etre vide.')
    .isLength({ max: 200 }).withMessage('Le titre ne doit pas depasser 200 caracteres.'),
  body('description')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 2000 }).withMessage('La description ne doit pas depasser 2000 caracteres.'),
  body('status')
    .optional()
    .isIn(STATUSES).withMessage(`Le statut doit etre l'un de : ${STATUSES.join(', ')}.`),
  body('due_date')
    .optional({ checkFalsy: true })
    .isISO8601().withMessage('La date d\'echeance doit etre une date valide (AAAA-MM-JJ).')
    .toDate(),
];

module.exports = {
  STATUSES,
  idParamValidator,
  listQueryValidators,
  createTaskValidators,
  updateTaskValidators,
};
