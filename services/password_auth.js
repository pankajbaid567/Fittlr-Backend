const bcrypt = require("bcrypt");

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

const comparePassword = async (givenPassword, storedPassword) => {
  return await bcrypt.compare(givenPassword, storedPassword);
};

module.exports = { hashPassword, comparePassword };
