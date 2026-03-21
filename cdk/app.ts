import { App } from 'aws-cdk-lib';

import { AlgorithmVisualizerStack } from './stack';

const app = new App();

new AlgorithmVisualizerStack(app, 'AlgorithmVisualizerStack');
