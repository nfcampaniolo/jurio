const devCerts = require("office-addin-dev-certs");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const { resolveTarget, transformManifest } = require("./build-targets");

/** Variabili condivise con la web app (../.env.development o ../.env.production, secondo l'ambiente). */
function loadEnv(envFile) {
  const file = path.resolve(__dirname, "..", envFile);
  return dotenv.config({ path: file, processEnv: {} }).parsed || {};
}

/** URL Cloud Run di una funzione: esplicito o derivato da quello di legalAgent dello stesso progetto. */
function resolveFunctionUrl(env, explicitKey, functionName) {
  if (env[explicitKey]) return env[explicitKey];
  const legal = env.VITE_LEGAL_AGENT_ENDPOINT || "";
  return legal.includes("://legalagent-") ? legal.replace("://legalagent-", `://${functionName}-`) : "";
}

const readSitePage = (name) => fs.readFileSync(path.resolve(__dirname, "src/site", name), "utf8");

async function getHttpsOptions() {
  const httpsOptions = await devCerts.getHttpsServerOptions();
  return { ca: httpsOptions.ca, key: httpsOptions.key, cert: httpsOptions.cert };
}

module.exports = async (env, options) => {
  const dev = options.mode === "development";
  const target = resolveTarget(env, options.mode);
  const envVars = loadEnv(target.envFile);

  const firebaseConfig = {
    apiKey: envVars.VITE_FIREBASE_API_KEY,
    authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: envVars.VITE_FIREBASE_PROJECT_ID,
    storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: envVars.VITE_FIREBASE_APP_ID,
    measurementId: envVars.VITE_FIREBASE_MEASUREMENT_ID,
  };
  const wordAgentUrl = resolveFunctionUrl(envVars, "VITE_WORD_AGENT_URL", "wordagent");
  const wordAuthUrl = resolveFunctionUrl(envVars, "VITE_WORD_AUTH_URL", "wordauth");

  const missing = [
    ...Object.entries(firebaseConfig)
      .filter(([k, v]) => !v && k !== "measurementId")
      .map(([k]) => `firebase.${k}`),
    ...(wordAgentUrl ? [] : ["VITE_WORD_AGENT_URL"]),
    ...(wordAuthUrl ? [] : ["VITE_WORD_AUTH_URL"]),
    ...(envVars.VITE_RECAPTCHA_SITE_KEY ? [] : ["VITE_RECAPTCHA_SITE_KEY"]),
  ];
  if (missing.length) {
    const msg = `[word] Variabili mancanti in ${target.envFile} (ambiente ${target.name}): ${missing.join(", ")}`;
    if (!dev) throw new Error(msg);
    console.warn(msg);
  }

  const config = {
    // Source map solo in sviluppo: in produzione non si pubblica il sorgente
    devtool: dev ? "source-map" : false,
    entry: {
      react: ["react", "react-dom"],
      taskpane: {
        import: ["./src/taskpane/index.tsx", "./src/taskpane/taskpane.html"],
        dependOn: "react",
      },
      commands: "./src/commands/commands.ts",
    },
    output: {
      clean: true,
      // In build i file hanno l'hash del contenuto: Hosting li mette in cache a lungo senza servire versioni vecchie.
      filename: dev ? "[name].js" : "[name].[contenthash:10].js",
    },
    // Budget: il pannello deve aprirsi in fretta anche su reti lente. Superarlo è una regressione da
    // verificare (in build di produzione l'avviso diventa un errore).
    performance: {
      hints: dev ? false : "error",
      maxEntrypointSize: 520 * 1024,
      maxAssetSize: 420 * 1024,
    },
    resolve: {
      extensions: [".ts", ".tsx", ".html", ".js"],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: ["ts-loader"],
        },
        {
          test: /\.html$/,
          exclude: /node_modules/,
          use: "html-loader",
        },
        {
          test: /\.(png|jpg|jpeg|ttf|woff|woff2|gif|ico)$/,
          type: "asset/resource",
          generator: {
            filename: "assets/[name][ext][query]",
          },
        },
        {
          test: /\.css$/i,
          use: [MiniCssExtractPlugin.loader, "css-loader"],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        filename: "taskpane.html",
        template: "./src/taskpane/taskpane.html",
        chunks: ["taskpane", "react"],
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "assets/*",
            to: "assets/[name][ext][query]",
          },
          {
            from: "manifest*.xml",
            to: "[name]" + "[ext]",
            transform(content) {
              return transformManifest(content.toString(), target);
            },
          },
        ],
      }),
      // Pagina all'indirizzo principale del sito (istruzioni e manifest) e pagina 404
      // (pagine statiche: niente html-loader, le immagini arrivano da assets/ copiato più sotto)
      new HtmlWebpackPlugin({
        filename: "index.html",
        templateContent: () =>
          readSitePage("index.html")
            .split("__DISPLAY_NAME__")
            .join(target.displayName)
            .split("__MANIFEST_URL__")
            .join(`${target.url}/manifest.xml`)
            .split("__SITE_HOST__")
            .join(new URL(target.url).host)
            .split("__ENV_BADGE__")
            .join(target.name === "production" ? "" : '<span class="env">Ambiente di test</span>'),
        inject: false,
      }),
      new HtmlWebpackPlugin({
        filename: "404.html",
        templateContent: () => readSitePage("404.html"),
        inject: false,
      }),
      new HtmlWebpackPlugin({
        filename: "commands.html",
        template: "./src/commands/commands.html",
        chunks: ["commands"],
      }),
      new webpack.DefinePlugin({
        __FIREBASE_CONFIG__: JSON.stringify(firebaseConfig),
        __WORD_AGENT_URL__: JSON.stringify(wordAgentUrl),
        __WORD_AUTH_URL__: JSON.stringify(wordAuthUrl),
        __WEB_APP_URL__: JSON.stringify(target.webAppUrl),
        __RECAPTCHA_SITE_KEY__: JSON.stringify(envVars.VITE_RECAPTCHA_SITE_KEY || ""),
        // Il token debug di App Check consente di aggirare App Check: MAI nella build di produzione
        __APPCHECK_DEBUG_TOKEN__: JSON.stringify(
          dev && target.appCheckDebugToken ? envVars.VITE_APPCHECK_DEBUG_TOKEN || "" : ""
        ),
      }),
      new MiniCssExtractPlugin({
        filename: dev ? "[name].css" : "[name].[contenthash:10].css",
      }),
    ],
    devServer: {
      hot: true,
      server: {
        type: "https",
        options:
          env.WEBPACK_BUILD || options.https !== undefined
            ? options.https
            : await getHttpsOptions(),
      },
      port: process.env.npm_package_config_dev_server_port || 3000,
    },
  };

  return config;
};
