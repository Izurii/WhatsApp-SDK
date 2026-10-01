/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const { themes } = require('prism-react-renderer');
const lightCodeTheme = themes.github;
const darkCodeTheme = themes.dracula;

/** @type {import('@docusaurus/types').Config} */
const config = {
	title: 'whatsapp-sdk-js',
	tagline: 'Node.js SDK for the WhatsApp Cloud API',
	favicon: 'img/favicon.ico',

	// Set the production url of your site here
	url: 'https://izurii.github.io',
	// Set the /<baseUrl>/ pathname under which your site is served
	// For GitHub pages deployment, it is often '/<projectName>/'
	baseUrl: '/WhatsApp-SDK/',

	// GitHub pages deployment config.
	// If you aren't using GitHub pages, you don't need these.
	organizationName: 'Izurii',
	projectName: 'WhatsApp-SDK',

	onBrokenLinks: 'throw',
	markdown: { hooks: { onBrokenMarkdownLinks: 'throw' } },

	// Even if you don't use internalization, you can use this field to set useful
	// metadata like html lang. For example, if your site is Chinese, you may want
	// to replace "en" with "zh-Hans".
	i18n: {
		defaultLocale: 'en',
		locales: ['en'],
	},

	presets: [
		[
			'classic',
			/** @type {import('@docusaurus/preset-classic').Options} */
			({
				docs: {
					routeBasePath: '/',
					sidebarPath: require.resolve('./sidebars.js'),
					// Please change this to your repo.
					// Remove this to remove the "edit this page" links.
					editUrl: 'https://github.com/Izurii/WhatsApp-SDK/tree/main/website/',
				},
				blog: false,
				theme: {
					customCss: require.resolve('./src/css/custom.css'),
				},
			}),
		],
	],

	themeConfig:
		/** @type {import('@docusaurus/preset-classic').ThemeConfig} */
		({
			colorMode: {
				defaultMode: 'dark',
				// disableSwitch: false
			},
			// Replace with your project's social card
			image: 'img/wa_logo-216px.svg',
			navbar: {
				title: 'whatsapp-sdk-js',
				logo: {
					alt: 'WhatsApp logo',
					src: 'img/Digital_Glyph_Green.svg',
				},
				items: [
					{
						href: 'https://github.com/Izurii/WhatsApp-SDK',
						label: 'GitHub',
						position: 'right',
					},
				],
			},
			footer: {
				style: 'dark',
				links: [
					{
						title: 'Docs',
						items: [
							{
								label: 'Cloud API',
								to: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
							},
							{
								label: 'Business Management API',
								to: 'https://developers.facebook.com/docs/whatsapp/business-management-api',
							},
						],
					},
					{
						title: 'Community',
						items: [
							{
								label: 'LinkedIn',
								href: 'https://www.linkedin.com/showcase/whatsapp-business/',
							},
							{
								label: 'Twitter',
								href: 'https://twitter.com/whatsappbiz',
							},
						],
					},
					{
						title: 'More',
						items: [
							{
								label: 'GitHub',
								href: 'https://github.com/Izurii/WhatsApp-SDK',
							},
						],
					},
					{
						title: 'Legal',
						items: [
							{
								label: 'Privacy',
								href: 'https://opensource.fb.com/legal/privacy',
								target: '_blank',
								rel: 'noreferrer noopener',
							},
							{
								label: 'Terms',
								href: 'https://opensource.fb.com/legal/terms',
								target: '_blank',
								rel: 'noreferrer noopener',
							},
						],
					},
				],
				copyright: `Copyright © ${new Date().getFullYear()} Meta Platforms, Inc. Built for the dev community with love by Rashed Talukder using Docusaurus.`,
			},
			prism: {
				theme: lightCodeTheme,
				darkTheme: darkCodeTheme,
			},
		}),
};

module.exports = config;
