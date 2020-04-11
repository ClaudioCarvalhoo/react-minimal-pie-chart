// @ts-nocheck
import React from 'react';
import { render, dataMock, getArcInfo } from './testUtils';
import { degreesToRadians } from '../utils';

jest.useFakeTimers();

beforeAll(() => {
  global.requestAnimationFrame = (callback) => {
    callback();
    return 'id';
  };
});

describe('Chart', () => {
  it('return null if props.data is undefined', () => {
    const { container } = render({
      data: undefined,
    });
    expect(container).toBeEmpty();
  });

  describe('wrapper element', () => {
    it('receive "className" and "style" props', () => {
      const { container } = render({
        className: 'foo',
        style: { color: 'green' },
      });
      const wrapper = container.firstChild;
      expect(wrapper).toHaveAttribute('class', 'foo');
      expect(wrapper).toHaveStyle({ color: 'green' });
    });
  });

  describe('viewBoxSize prop', () => {
    it.each`
      viewBoxSize   | expectedSize
      ${undefined}  | ${[100, 100]}
      ${[500, 500]} | ${[500, 500]}
      ${[500, 250]} | ${[500, 250]}
    `(
      'renders full-width chart in a SVG viewBox of given size',
      ({ viewBoxSize, expectedSize }) => {
        const [expectedWidth, expectedHeight] = expectedSize;
        const { container } = render({
          viewBoxSize,
        });
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute(
          'viewBox',
          `0 0 ${expectedWidth} ${expectedHeight}`
        );

        const firstPath = container.querySelector('path');
        const firstPathInfo = getArcInfo(firstPath);
        expect(firstPathInfo.radius).toBe(expectedWidth / 4);
        expect(firstPathInfo.startPoint.y).toBe(expectedHeight / 2);
      }
    );
  });

  describe('Partial circle', () => {
    it('render a set of arc paths with total lengthAngle === 270°', () => {
      const pieLengthAngle = 270;
      let pathsTotalLengthAngle = 0;

      const { container } = render({
        lengthAngle: pieLengthAngle,
      });
      container.querySelectorAll('path').forEach((path) => {
        pathsTotalLengthAngle += getArcInfo(path).lengthAngle;
      });
      expect(pathsTotalLengthAngle).toEqual(pieLengthAngle);
    });

    it('renders a set of arc paths with total negative lengthAngle === -270°', () => {
      const pieLengthAngle = -270;
      let pathsTotalLengthAngle = 0;

      const { container } = render({
        lengthAngle: pieLengthAngle,
      });
      container.querySelectorAll('path').forEach((path) => {
        pathsTotalLengthAngle += getArcInfo(path).lengthAngle;
      });
      expect(pathsTotalLengthAngle).toEqual(pieLengthAngle);
    });
  });

  describe('paddingAngle prop', () => {
    it('render a set of arc paths + paddings with total length === "lengthAngle"', () => {
      const pieLengthAngle = 300;
      let pathsTotalLengthAngle = 0;
      const totalPaddingDegrees = 10 * (dataMock.length - 1);

      const { container } = render({
        lengthAngle: pieLengthAngle,
        paddingAngle: 10,
      });
      container.querySelectorAll('path').forEach((path) => {
        pathsTotalLengthAngle += getArcInfo(path).lengthAngle;
      });
      expect(pieLengthAngle).toEqualWithRoundingError(
        pathsTotalLengthAngle + totalPaddingDegrees
      );
    });
  });

  describe('background prop', () => {
    describe('render a background segment as long as the whole chart', () => {
      const { container } = render({
        startAngle: 0,
        lengthAngle: 200,
        background: 'green',
      });
      const [background, segment] = container.querySelectorAll('path');
      const backgroundInfo = getArcInfo(background);
      const segmentInfo = getArcInfo(segment);

      expect(backgroundInfo.startAngle).toBe(0);
      expect(backgroundInfo.lengthAngle).toBe(200);
      expect(backgroundInfo.radius).toEqual(segmentInfo.radius);
      expect(background).toHaveAttribute('fill', 'none');
      expect(background).toHaveAttribute('stroke', 'green');
      expect(background).toHaveAttribute(
        'stroke-width',
        segment.getAttribute('stroke-width')
      );
    });
  });

  describe('animate prop', () => {
    describe('Segments "style.transition" prop', () => {
      it('receive "stroke-dashoffset" transition prop with custom duration/easing', () => {
        const { container } = render({
          animate: true,
          animationDuration: 100,
          animationEasing: 'ease',
        });
        const firstPath = container.querySelector('path');
        expect(firstPath).toHaveStyle({
          transition: 'stroke-dashoffset 100ms ease',
        });
      });

      it('merge autogenerated CSS transition prop with the one optionally provided by "segmentsStyle"', () => {
        const { container } = render({
          segmentsStyle: {
            transition: 'custom-transition',
          },
          animate: true,
          animationDuration: 100,
          animationEasing: 'ease',
        });
        const firstPath = container.querySelector('path');
        expect(firstPath).toHaveStyle({
          transition: 'stroke-dashoffset 100ms ease,custom-transition',
        });
      });
    });

    describe.each`
      reveal       | expectedRevealedDegrees
      ${undefined} | ${360}
      ${50}        | ${180}
    `('reveal === ${reveal}', ({ reveal, expectedRevealedDegrees }) => {
      it('re-render on did mount revealing the expected portion of segment', () => {
        const segmentRadius = 25;
        const lengthAngle = 360;
        const fullPathLength = degreesToRadians(segmentRadius) * lengthAngle;

        const singleEntryDataMock = [...dataMock[0]];
        const { container } = render({
          data: singleEntryDataMock,
          animate: true,
          lengthAngle,
          reveal,
        });

        const path = container.querySelector('path');

        // Path hidden
        expect(path).toHaveAttribute('stroke-dasharray', `${fullPathLength}`);
        expect(path).toHaveAttribute('stroke-dashoffset', `${fullPathLength}`);

        // Complete componentDidMount callback execution
        jest.runAllTimers();

        const expectedRevealedPathLength =
          (fullPathLength / lengthAngle) * expectedRevealedDegrees;

        expect(path).toHaveAttribute('stroke-dasharray', `${fullPathLength}`);
        expect(path).toHaveAttribute(
          'stroke-dashoffset',
          `${fullPathLength - expectedRevealedPathLength}`
        );
      });
    });

    it("don't re-render when component is unmounted", () => {
      // Simulate edge case of animation fired after component was unmounted
      // See: https://github.com/toomuchdesign/react-minimal-pie-chart/issues/8
      jest.spyOn(console, 'error');
      const { unmount, rerender } = render({
        animate: true,
      });

      unmount();
      jest.runAllTimers();
      rerender();

      expect(console.error).not.toHaveBeenCalled();
      console.error.mockRestore();
    });
  });

  describe('data.title prop', () => {
    it('render a <Title> element in each path', () => {
      const { container } = render({
        data: [{ title: 'title-value', value: 10, color: 'blue' }],
      });

      const title = container.querySelector('title');
      expect(title).toHaveTextContent('title-value');
    });
  });

  describe('injectSvg prop', () => {
    it('inject anything into rendered <svg>', () => {
      const { container } = render({
        injectSvg: () => <defs />,
      });

      const injectedElement = container.querySelector('svg > defs');
      expect(injectedElement).toBeInTheDocument();
    });
  });
});
