import type { Meta, StoryObj } from '@storybook/react';
import { Subject } from 'rxjs';
import EventView from './View';
import { EarthquakeInformation } from '@dmdata/telegram-json-types';

const meta: Meta<typeof EventView> = {
  title: 'Monitor/EarthQuake/EventView',
  component: EventView,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof EventView>;

const mockEventData$ = new Subject<{ data: EarthquakeInformation.Latest.Main; latestInformation: boolean }>();

export const Default: Story = {
  args: {
    eventData$: mockEventData$,
  },
  play: async () => {
    setTimeout(() => {
      const mockData = {
        _schema: {
          type: 'earthquake-information' as const,
          version: '1.1.0' as const,
        },
        type: '震源・震度情報' as const,
        title: '震源・震度情報' as const,
        status: '通常',
        infoType: '発表',
        editorialOffice: '気象庁本庁',
        publishingOffice: ['気象庁'],
        pressDateTime: '2023-01-01T12:00:00+09:00',
        reportDateTime: '2023-01-01T12:00:00+09:00',
        targetDateTime: '2023-01-01T12:00:00+09:00',
        eventId: 'test-event-id',
        serialNo: '1',
        body: {
          earthquake: {
            originTime: '2023-01-01T11:55:00+09:00',
            arrivalTime: '2023-01-01T11:55:00+09:00',
            hypocenter: {
              name: '東京湾',
              code: '485',
              coordinate: {
                latitude: {
                  value: '35.6',
                  text: '北緯３５．６度',
                },
                longitude: {
                  value: '139.8',
                  text: '東経１３９．８度',
                },
                height: {
                  value: '10000',
                  unit: 'm',
                },
              },
              depth: {
                value: '10',
                unit: 'km',
              },
            },
            magnitude: {
              value: '5.0',
            },
          },
          intensity: {
            maxInt: '5-',
            regions: [
              {
                name: '東京都',
                code: '350',
                maxInt: '5-',
              },
              {
                name: '神奈川県',
                code: '360',
                maxInt: '4',
              },
              {
                name: '千葉県',
                code: '340',
                maxInt: '4',
              },
            ],
          },
          comments: {
            forecast: {
              text: '今後の情報に注意してください。',
              codes: ['0215'],
            },
            var: {
              text: 'この地震による津波の心配はありません。',
              codes: ['0215'],
            },
          },
        },
      } as unknown as EarthquakeInformation.Latest.Main;

      mockEventData$.next({
        data: mockData,
        latestInformation: true,
      });
    }, 1000);
  },
};
