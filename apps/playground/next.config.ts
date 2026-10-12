import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['ckeditor5', '@ckeditor/ckeditor5-react'],
}

export default config
