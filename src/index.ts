import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join, extname, resolve, dirname, basename } from 'path';
import { v2 as cloudinary } from 'cloudinary';

let imageCachePath;
let imageCache = {};

function initCloudinaryUploadCache() {
  try {
    mkdirSync(join(process.cwd(), './.cache/'));
  } catch (err) {
    // no-op — if the folder exists this will throw
  }

  imageCachePath = join(process.cwd(), './.cache/cloudinary-11ty.json');

  if (existsSync(imageCachePath)) {
    imageCache = require(imageCachePath);
  }
}

const upload = async ({ imagePath, folder }) => {
  const res = await cloudinary.uploader.upload(imagePath, {
    folder,
    use_filename: true, // use the filename as the public ID
    overwrite: false, // don't re-upload images with the same filename
    unique_filename: false, // required to avoid duplicate uploads
  });

  return res;
};

type GetMdPluginOptions = {
  /**
   * Find yours at https://cloudinary.com/console
   */
  cloud_name: string;

  /**
   * Defaults to `https://res.cloudinary.com/`
   */
  base_url?: string;

  /**
   * If set, images will be placed into this folder in your Cloudinary account
   */
  folder: string;

  /**
   * Transformations to apply to all images
   */
  base_transformation?: string;

  /**
   * Ideally, set this to the same width as your content area
   */
  image_width?: number;
};

type MdPluginFunction = (md: any) => void;

const getMdPlugin =
  ({
    cloud_name,
    folder,
    base_transformation,
    base_url,
    image_width,
  }: GetMdPluginOptions): MdPluginFunction =>
  (md) => {
    md.core.ruler.push('cloudinary', (state) => {
      state.tokens.forEach((token) => {
        if (token.type !== 'inline') {
          return;
        }

        if (!token.children || token.children[0].type !== 'image') {
          return;
        }

        const image = token.children[0];
        let src = image.attrGet('src');

        // IDEA: figure out a way to optimize GIFs
        if (extname(src) === '.gif') {
          return;
        }

        if (!src.startsWith(base_url)) {
          if (imageCache[src]) {
            src = imageCache[src];
          } else {
            const filePath = resolve(state.env.page.inputPath);
            const imagePath = join(dirname(filePath), src);

            upload({ imagePath, folder });

            // no async in markdown-it (yay!) so we have to fake this a bit
            const newSrc = new URL(base_url);
            const pathParts = [
              cloud_name,
              'image',
              'upload',
              base_transformation,
              folder,
              basename(imagePath),
            ].filter(Boolean);

            newSrc.pathname = pathParts.join('/');

            imageCache[src] = newSrc.toString();
            src = newSrc.toString();
          }

          image.attrSet('src', src);
        }

        const srcSet = [image_width * 3, image_width * 3, image_width, 300]
          .map(
            (size) =>
              `${src.replace(
                base_transformation,
                `${base_transformation},w_${size}`,
              )} ${size}w`,
          )
          .join(',');

        image.attrSet('srcset', srcSet);
        image.attrSet('loading', 'lazy');

        // don't forget to match this to content column width
        image.attrSet(
          'sizes',
          `(max-width: ${image_width}px) 100vw, ${image_width}px`,
        );
      });

      console.log({ imageCachePath, imageCache });
      writeFileSync(imageCachePath, JSON.stringify(imageCache));
    });
  };

type GetAsyncFilterOptions = {
  /**
   * If set, images will be placed into this folder in your Cloudinary account
   */
  folder: string;

  /**
   * Ideally, set this to the same width as your content area
   */
  image_width: number;

  /**
   * Transformations to apply to all images (default: `f_auto,q_auto`)
   */
  base_transformation: string;
};

type AsyncFilterFunction = (
  value: string,
  currentFile: string,
  width: number,
  callback: (error: any, result: string) => void,
) => Promise<void>;

function getAsyncFilter({
  folder,
  image_width,
  base_transformation,
}: GetAsyncFilterOptions): AsyncFilterFunction {
  return async (value, currentFile, width = image_width, callback) => {
    const baseDir = dirname(currentFile);
    const imagePath = join(baseDir, value);

    let newSrc;

    if (imageCache[imagePath]) {
      newSrc = imageCache[imagePath];
    } else {
      const res = await upload({ imagePath, folder });

      newSrc = res.secure_url.replace(
        /upload/,
        `upload/${base_transformation},w_${width}`,
      );
      imageCache[imagePath] = newSrc;
    }

    writeFileSync(imageCachePath, JSON.stringify(imageCache));

    callback(null, newSrc);
  };
}

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
  folder: string;

  /**
   * Transformations to apply to all images
   */
  base_transformation?: string;

  /**
   * Ideally, set this to the same width as your content area
   */
  image_width?: number;
};

export default function eleventyCloudinaryHelpers({
  cloud_name,
  api_key = process.env.CLOUDINARY_API_KEY,
  api_secret = process.env.CLOUDINARY_API_SECRET,
  base_url = 'https://res.cloudinary.com/',
  folder,
  base_transformation = 'f_auto,q_auto',
  image_width = 800,
}: CloudinaryHelperOptions) {
  if (!cloud_name) {
    // TODO link to the README docs once they exist
    throw new Error('A Cloudinary cloud name must be supplied.');
  }

  if (!api_key || !api_secret) {
    // TODO link to the README docs once they exist
    throw new Error('A Cloudinary API key and secret must be supplied.');
  }

  initCloudinaryUploadCache();

  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });

  return {
    mdPlugin: getMdPlugin({
      cloud_name,
      folder,
      base_transformation,
      base_url,
      image_width,
    }),
    asyncFilter: getAsyncFilter({ folder, image_width, base_transformation }),
  };
}
