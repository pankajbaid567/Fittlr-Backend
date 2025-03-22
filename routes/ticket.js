const express = require("express");
const router = express.Router();

const routers = express.Router();

const {
  createTicket,
  get_user_ticket,
  update_ticket,
  delete_ticket,
} = require("../controllers/tickets/tickets");

routers.post("/create", createTicket);
routers.get("/get", get_user_ticket);
routers.put("/update", update_ticket);
routers.delete("/delete", delete_ticket);

module.exports = router;
