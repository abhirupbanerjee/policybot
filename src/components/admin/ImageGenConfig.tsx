'use client';

/**
 * Image Generation Tool Configuration Component
 *
 * Admin UI for configuring the image_gen tool:
 * - Provider selection (OpenAI DALL-E / Google Gemini)
 * - Provider-specific settings
 * - Image processing options
 * - Prompt enhancement settings
 */

import React from 'react';
import { Info, Image as ImageIcon, Sparkles, Settings2 } from 'lucide-react';

interface ImageGenConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  disabled: boolean;
}

export default function ImageGenConfig({
  config,
  onChange,
  disabled,
}: ImageGenConfigProps) {
  const handleChange = (key: string, value: unknown) => {
    onChange({ ...config, [key]: value });
  };

  const handleProviderChange = (
    provider: 'openai' | 'gemini',
    key: string,
    value: unknown
  ) => {
    const providers = (config.providers as Record<string, Record<string, unknown>>) || {};
    onChange({
      ...config,
      providers: {
        ...providers,
        [provider]: {
          ...providers[provider],
          [key]: value,
        },
      },
    });
  };

  const handleImageProcessingChange = (key: string, value: unknown) => {
    const imageProcessing =
      (config.imageProcessing as Record<string, unknown>) || {};
    onChange({
      ...config,
      imageProcessing: {
        ...imageProcessing,
        [key]: value,
      },
    });
  };

  const providers =
    (config.providers as Record<string, Record<string, unknown>>) || {};
  const openaiConfig = providers.openai || {};
  const geminiConfig = providers.gemini || {};
  const imageProcessing =
    (config.imageProcessing as Record<string, unknown>) || {};

  return (
    <div className="space-y-6">
      {/* Active Provider */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Default Provider
        </label>
        <select
          value={(config.activeProvider as string) || 'gemini'}
          onChange={(e) => handleChange('activeProvider', e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          disabled={disabled}
        >
          <option value="none">Disabled</option>
          <option value="openai">OpenAI DALL-E 3</option>
          <option value="gemini">Google Gemini (Nano Banana Pro)</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Gemini is recommended for infographics with legible text
        </p>
      </div>

      {/* Infographic Provider Recommendation */}
      <div className="p-3 bg-blue-50 rounded-lg flex items-start gap-2">
        <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <strong>Tip:</strong> Gemini Nano Banana Pro excels at generating
          infographics with legible text, accurate data visualizations, and
          professional layouts. Use DALL-E 3 for photorealistic images and
          artistic illustrations.
        </div>
      </div>

      {/* OpenAI Settings */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ImageIcon size={18} className="text-gray-600" />
            <h4 className="font-medium text-gray-900">OpenAI DALL-E 3</h4>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(openaiConfig.enabled as boolean) || false}
              onChange={(e) =>
                handleProviderChange('openai', 'enabled', e.target.checked)
              }
              disabled={disabled}
              className="rounded"
            />
            <span className="text-sm">Enabled</span>
          </label>
        </div>

        {(openaiConfig.enabled as boolean) && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model
              </label>
              <select
                value={(openaiConfig.model as string) || 'dall-e-3'}
                onChange={(e) =>
                  handleProviderChange('openai', 'model', e.target.value)
                }
                className="w-full px-3 py-2 border rounded-lg"
                disabled={disabled}
              >
                <option value="dall-e-3">DALL-E 3</option>
                <option value="dall-e-2">DALL-E 2</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quality
              </label>
              <select
                value={(openaiConfig.quality as string) || 'standard'}
                onChange={(e) =>
                  handleProviderChange('openai', 'quality', e.target.value)
                }
                className="w-full px-3 py-2 border rounded-lg"
                disabled={disabled}
              >
                <option value="standard">Standard ($0.04/image)</option>
                <option value="hd">HD ($0.08/image)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Size
              </label>
              <select
                value={(openaiConfig.size as string) || '1024x1024'}
                onChange={(e) =>
                  handleProviderChange('openai', 'size', e.target.value)
                }
                className="w-full px-3 py-2 border rounded-lg"
                disabled={disabled}
              >
                <option value="1024x1024">1024x1024 (Square)</option>
                <option value="1792x1024">1792x1024 (Landscape)</option>
                <option value="1024x1792">1024x1792 (Portrait)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Style
              </label>
              <select
                value={(openaiConfig.style as string) || 'natural'}
                onChange={(e) =>
                  handleProviderChange('openai', 'style', e.target.value)
                }
                className="w-full px-3 py-2 border rounded-lg"
                disabled={disabled}
              >
                <option value="natural">Natural</option>
                <option value="vivid">Vivid</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Gemini Settings */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-purple-600" />
              <h4 className="font-medium text-gray-900">Google Gemini</h4>
            </div>
            <p className="text-xs text-gray-500">
              Nano Banana Pro - Best for infographics
            </p>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(geminiConfig.enabled as boolean) || false}
              onChange={(e) =>
                handleProviderChange('gemini', 'enabled', e.target.checked)
              }
              disabled={disabled}
              className="rounded"
            />
            <span className="text-sm">Enabled</span>
          </label>
        </div>

        {(geminiConfig.enabled as boolean) && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model
              </label>
              <select
                value={
                  (geminiConfig.model as string) || 'gemini-3-pro-image-preview'
                }
                onChange={(e) =>
                  handleProviderChange('gemini', 'model', e.target.value)
                }
                className="w-full px-3 py-2 border rounded-lg"
                disabled={disabled}
              >
                <option value="gemini-3-pro-image-preview">
                  Nano Banana Pro ($0.039/image)
                </option>
                <option value="imagen-3.0-generate-002">
                  Imagen 3 ($0.03/image)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Aspect Ratio
              </label>
              <select
                value={(geminiConfig.aspectRatio as string) || '16:9'}
                onChange={(e) =>
                  handleProviderChange('gemini', 'aspectRatio', e.target.value)
                }
                className="w-full px-3 py-2 border rounded-lg"
                disabled={disabled}
              >
                <option value="1:1">1:1 (Square)</option>
                <option value="16:9">16:9 (Presentation)</option>
                <option value="9:16">9:16 (Mobile)</option>
                <option value="4:3">4:3 (Standard)</option>
                <option value="3:4">3:4 (Portrait)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* General Settings */}
      <div className="border-t pt-4">
        <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Settings2 size={16} />
          General Settings
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Style
            </label>
            <select
              value={(config.defaultStyle as string) || 'infographic'}
              onChange={(e) => handleChange('defaultStyle', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              disabled={disabled}
            >
              <option value="infographic">Infographic</option>
              <option value="diagram">Diagram</option>
              <option value="process-flow">Process Flow</option>
              <option value="chart">Chart</option>
              <option value="illustration">Illustration</option>
              <option value="photo">Photo</option>
              <option value="icon">Icon</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Infographic Provider
            </label>
            <select
              value={(config.infographicProvider as string) || 'gemini'}
              onChange={(e) =>
                handleChange('infographicProvider', e.target.value)
              }
              className="w-full px-3 py-2 border rounded-lg"
              disabled={disabled}
            >
              <option value="gemini">Gemini (Recommended)</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(config.enhancePrompts as boolean) ?? true}
              onChange={(e) => handleChange('enhancePrompts', e.target.checked)}
              disabled={disabled}
              className="rounded"
            />
            <span className="text-sm">Enhance Prompts</span>
            <span className="text-xs text-gray-500">
              (Add style-specific instructions for better results)
            </span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(config.addSafetyPrefixes as boolean) ?? true}
              onChange={(e) =>
                handleChange('addSafetyPrefixes', e.target.checked)
              }
              disabled={disabled}
              className="rounded"
            />
            <span className="text-sm">Add Safety Prefixes</span>
            <span className="text-xs text-gray-500">
              (Workplace-appropriate content)
            </span>
          </label>
        </div>
      </div>

      {/* Image Processing Settings */}
      <div className="border-t pt-4">
        <h4 className="font-medium text-gray-900 mb-4">
          Image Processing & Optimization
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Dimension (pixels)
            </label>
            <input
              type="number"
              min={1024}
              max={4096}
              value={(imageProcessing.maxDimension as number) || 2048}
              onChange={(e) =>
                handleImageProcessingChange(
                  'maxDimension',
                  parseInt(e.target.value) || 2048
                )
              }
              className="w-full px-3 py-2 border rounded-lg"
              disabled={disabled}
            />
            <p className="text-xs text-gray-500 mt-1">
              Images larger than this will be resized (1024-4096)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Output Format
            </label>
            <select
              value={(imageProcessing.format as string) || 'webp'}
              onChange={(e) =>
                handleImageProcessingChange('format', e.target.value)
              }
              className="w-full px-3 py-2 border rounded-lg"
              disabled={disabled}
            >
              <option value="webp">WebP (Smallest, recommended)</option>
              <option value="png">PNG (Lossless)</option>
              <option value="jpeg">JPEG (Good compression)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quality (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={(imageProcessing.quality as number) || 85}
              onChange={(e) =>
                handleImageProcessingChange(
                  'quality',
                  parseInt(e.target.value) || 85
                )
              }
              className="w-full px-3 py-2 border rounded-lg"
              disabled={disabled}
            />
            <p className="text-xs text-gray-500 mt-1">
              WebP/JPEG quality (0-100)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Thumbnail Size (pixels)
            </label>
            <input
              type="number"
              min={100}
              max={800}
              value={(imageProcessing.thumbnailSize as number) || 400}
              onChange={(e) =>
                handleImageProcessingChange(
                  'thumbnailSize',
                  parseInt(e.target.value) || 400
                )
              }
              className="w-full px-3 py-2 border rounded-lg"
              disabled={disabled}
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(imageProcessing.generateThumbnail as boolean) ?? true}
              onChange={(e) =>
                handleImageProcessingChange(
                  'generateThumbnail',
                  e.target.checked
                )
              }
              disabled={disabled}
              className="rounded"
            />
            <span className="text-sm">Generate Thumbnails</span>
            <span className="text-xs text-gray-500">
              (Small previews for faster chat loading)
            </span>
          </label>
        </div>
      </div>

      {/* Cost Estimation Info */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <h5 className="text-sm font-medium text-gray-700 mb-2">
          Estimated Costs per Image
        </h5>
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>DALL-E 3 Standard (1024x1024)</span>
            <span>$0.04</span>
          </div>
          <div className="flex justify-between">
            <span>DALL-E 3 HD (1024x1024)</span>
            <span>$0.08</span>
          </div>
          <div className="flex justify-between">
            <span>Gemini Nano Banana Pro</span>
            <span>$0.039</span>
          </div>
          <div className="flex justify-between">
            <span>Gemini Imagen 3</span>
            <span>$0.03</span>
          </div>
        </div>
      </div>
    </div>
  );
}
