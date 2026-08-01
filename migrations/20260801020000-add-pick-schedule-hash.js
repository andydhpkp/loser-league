module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable("pick");
    if (!columns.schedule_hash) {
      await queryInterface.addColumn("pick", "schedule_hash", {
        type: Sequelize.STRING(64),
        allowNull: true,
      });
    }
  },
  async down() {
    throw new Error("Pick schedule hash migration is forward-only");
  },
};
