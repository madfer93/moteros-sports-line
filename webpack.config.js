const path = require('path');
const Dotenv = require('dotenv-webpack');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';

    return {
        entry: {
            config: './js/config.js'
        },
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'js/[name].bundle.js',
            clean: false // Don't delete existing files
        },
        plugins: [
            // Cargar variables de entorno
            new Dotenv({
                path: './.env',
                safe: false,
                systemvars: true
            })
        ],
        optimization: {
            minimize: isProduction,
            minimizer: [
                new TerserPlugin({
                    terserOptions: {
                        compress: {
                            drop_console: isProduction, // Eliminar console.log en producción
                            drop_debugger: true
                        },
                        mangle: {
                            safari10: true
                        },
                        format: {
                            comments: false
                        }
                    },
                    extractComments: false
                })
            ]
        },
        devServer: {
            static: {
                directory: path.join(__dirname, './')
            },
            compress: true,
            port: 8080,
            hot: true,
            open: true
        },
        devtool: isProduction ? false : 'source-map',
        mode: argv.mode || 'development'
    };
};
