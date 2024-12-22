import { defineConfig } from 'tsup'

export default defineConfig( {
	entry		: [ 'src/**/*.ts' ],
	format		: [ 'cjs', 'esm' ],
	dts			: true,
	splitting	: false,
	shims		: true,
	skipNodeModulesBundle: true,
	clean		: true,
	treeshake	: true,
	minify		: true,
	outExtension( ctx ) {
		if ( ctx.format === 'esm' ) {
			return {
				dts	: '.d.ts',
				js	: '.mjs',
			}
		}
		return {
			js: '.cjs'
		}
	},
} )