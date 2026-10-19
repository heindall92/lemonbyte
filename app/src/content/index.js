/* LemonByte · índice del contenido para Node (pruebas). En el navegador, cada nivel se añade a window.LEMONBYTE_LEVELS en este orden. */
'use strict';
module.exports = { LEVELS: ['a0', 'a1', 'a2', 'b1', 'b2', 'c1'].map((id) => require(`./${id}.js`)) };
