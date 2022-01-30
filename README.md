# Cloudinary Eleventy Helpers

This is a collection of Eleventy Cloudinary helpers. It currently includes:

- **A `markdown-it` plugin** that converts local images in your Markdown files to Cloudinary URLs.
- **An async Nunjucks filter** that allows converting local images in frontmatter to Cloudinary URLs.

## Why is this useful?

Cloudinary offers a generous free tier, and it allows for automatica optimization, format conversion, and resizing. These utilities take advantage of this to increase your site's performance with very little effort on your part.

> **NOTE:** If you don't already have a Cloudinary account, you can [sign up for free here](https://jason.af/cloudinary). If you use this link to sign up, Cloudinary sends me a few dollars without any effect on the account you create, so consider this a kind of tip jar.

### Performance benefits of these utilities

- **Automatic format conversion** — Cloudinary will automatically serve modern formats like WebP instead of JPEGs when the browser supports them. This cuts down on bandwidth, loading time, and file size.

- **Automatic srcSet** — images in Markdown will have a [`srcset`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#attr-srcset) added, which has huge performance benefits, especially on smaller viewports.

- **Lazy loading** — images in Markdown have [`loading="lazy"`](https://addyosmani.com/blog/lazy-loading/) added, which improves initial page load times on supported browsers.

- **Automatic optimization** — Cloudinary will automatically optimize your images, which reduces the file size without impacting quality.

These add up to a pretty drastic impact on your site's performance without much manual effort to get it up and running.

## Installation

```sh
npm i @jlengstorf/cloudinary-11ty-helpers markdown-it
```

In your `.eleventy.js`:

```js
const cloudinary = require('@jlengstorf/cloudinary-11ty-helpers')({
  // find this at https://cloudinary.com/console
  cloud_name: 'YOUR_CLOUD_NAME',
  api_key: 'YOUR_API_KEY',
  api_secret: 'YOUR_API_SECRET',
});

module.exports = function (eleventyConfig) {
  /*
   * Modifying Markdown requires adding your own instance of the markdown-it
   * library so we can add plugins.
   */
  const markdown = require('markdown-it');

  const mdLib = markdown({ html: true }).use(cloudinary.mdPlugin);

  eleventyConfig.setLibrary('md', mdLib);

  /*
   * Adding the async Nunjucks filter is nice and straightforward.
   */
  eleventyConfig.addNunjucksAsyncFilter('cloudinary', cloudinary.asyncFilter);
};
```

## Usage

### Markdown plugin

Once the Markdown plugin is installed, local images in Markdown files will be converted to Cloudinary URLs with no additional work on your part.

Non-local images are ignored.

> **NOTE:** Currently GIFs are ignored. GIFs can consume a ton of Cloudinary bandwidth, so it's recommended to convert them to videos or to manually upload them to Cloudinary if you're sure you want to host GIFs on Cloudinary.

### Async Nunjucks filter

To use the filter, add it to any template variable that contains a relative image path:

```nunjucks
{% if image %}
<meta name="image" content="{{ image | cloudinary(page.inputPath, 1200) }}" />
{% else %}
```

> **NOTE:** `page.inputPath` is the path to the file that is being rendered. 11ty supplies this, so the value should be available in any Nunjucks template.

The above example assumes that the page being rendered has fronmatter with an `image` property. Assuming the file is at `src/my-page.md` and the image is at `src/images/my-image.jpg`, it should look something like this:

```md
---
image: ./images/my-image.jpg
---
```

## Configuration

The initialization function accepts a configuration object. Only the `cloud_name`, `api_key`, and `api_secret` are required for the utilities to work.

```ts
type CloudinaryHelperOptions = {
  /**
   * Find yours at https://cloudinary.com/console
   */
  cloud_name: string;

  /**
   * This can also be set via env var as `CLOUDINARY_API_KEY`
   */
  api_key?: string;

  /**
   * This can also be set via env var as `CLOUDINARY_API_SECRET`
   */
  api_secret?: string;

  /**
   * Defaults to `https://res.cloudinary.com/`
   */
  base_url?: string;

  /**
   * If set, images will be placed into this folder in your Cloudinary account
   */
  folder?: string;

  /**
   * Transformations to apply to all images
   */
  base_transformation?: string;

  /**
   * Ideally, set this to the same width as your content area
   */
  image_width?: number;
};
```

> **NOTE:** You can also set your API key and secret via env vars as `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. If you do, you can omit the `api_key` and `api_secret` options.
