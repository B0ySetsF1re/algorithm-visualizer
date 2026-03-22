import { App } from 'aws-cdk-lib';

import { AlgorithmVisualizerStack } from './stack';

const app = new App();

const environment = process.env.ENVIRONMENT ?? 'dev';

new AlgorithmVisualizerStack(app, `AlgorithmVisualizerStack-${environment}`, { environment });
