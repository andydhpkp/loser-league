module.exports = [
  {
    files: ["public/js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        alert: "readonly",
        bootstrap: "readonly",
        confirm: "readonly",
        console: "readonly",
        clearInterval: "readonly",
        document: "readonly",
        fetch: "readonly",
        location: "readonly",
        localStorage: "readonly",
        setInterval: "readonly",
        setTimeout: "readonly",
        window: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-redeclare": "error",
    },
  },
];
