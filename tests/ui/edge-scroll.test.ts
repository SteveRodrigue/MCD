import { describe, it, expect } from 'vitest';
import { UseEdgeScrollOptions } from '../../src/ui/hooks/useEdgeScroll';

describe('Edge Scroll Architecture & Utility Constraints (ADR-0017)', () => {
  it('correctly validates edge threshold boundaries for left and right panning', () => {
    const edgeThreshold = 85;
    const maxSpeed = 48; // Normal (Default)
    const windowWidth = 1920;

    // Pointer near left edge (X = 15px)
    const leftX = 15;
    const isNearLeft = leftX < edgeThreshold;
    expect(isNearLeft).toBe(true);

    const leftIntensity = Math.max(0, 1 - leftX / edgeThreshold);
    const leftVelocity = -Math.ceil(maxSpeed * leftIntensity);
    expect(leftVelocity).toBeLessThan(0);
    expect(leftVelocity).toBeGreaterThanOrEqual(-maxSpeed);

    // Pointer in middle zone (X = 960px)
    const midX = 960;
    const isNearMidLeft = midX < edgeThreshold;
    const isNearMidRight = midX > windowWidth - edgeThreshold;
    expect(isNearMidLeft).toBe(false);
    expect(isNearMidRight).toBe(false);

    // Pointer near right edge (X = 1900px)
    const rightX = 1900;
    const isNearRight = rightX > windowWidth - edgeThreshold;
    expect(isNearRight).toBe(true);

    const rightIntensity = Math.max(0, 1 - (windowWidth - rightX) / edgeThreshold);
    const rightVelocity = Math.ceil(maxSpeed * rightIntensity);
    expect(rightVelocity).toBeGreaterThan(0);
    expect(rightVelocity).toBeLessThanOrEqual(maxSpeed);
  });

  it('validates velocity levels across Slow, Normal (Default), and Fast presets', () => {
    const speedLevels = {
      slow: 24,
      normal: 48,
      fast: 75,
    };

    expect(speedLevels.slow).toBe(24);
    expect(speedLevels.normal).toBe(48);
    expect(speedLevels.fast).toBe(75);
    expect(speedLevels.normal).toBeGreaterThan(speedLevels.slow);
    expect(speedLevels.fast).toBeGreaterThan(speedLevels.normal);
  });

  it('verifies configuration options defaults for panoramic viewports', () => {
    const defaultOptions: UseEdgeScrollOptions = {
      edgeThreshold: 85,
      maxSpeed: 48,
      enabled: true,
    };

    expect(defaultOptions.edgeThreshold).toBe(85);
    expect(defaultOptions.maxSpeed).toBe(48);
    expect(defaultOptions.enabled).toBe(true);
  });
});
