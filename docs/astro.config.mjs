// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	base: '/ExoWeb',
	integrations: [
		starlight({
			title: 'ExoWeb',
			social: {
				github: 'https://github.com/cognitoforms/ExoWeb',
			},
			sidebar: [
				{
					label: 'Start Here',
					items: [
						{ label: 'What is ExoWeb', slug: 'what-is-exoweb', link: 'ExoWeb/what-is-exoweb' },
						{ label: 'Getting Started', slug: 'getting-started', link: 'ExoWeb/getting-started' },
					],
				},
				{
					label: 'Guides',
					items: [
						{ label: 'Entity Model Overview', slug: 'guides/entity-model-overview', link: 'ExoWeb/guides/entity-model-overview' },
						{ label: 'Template Syntax', slug: 'guides/template-syntax', link: 'ExoWeb/guides/template-syntax' },
					],
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
			],
		}),
	],
});
