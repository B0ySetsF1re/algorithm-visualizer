import * as cdk from 'aws-cdk-lib';
import { AlgorithmVisualizerStack } from './stack';

const app = new cdk.App();

new AlgorithmVisualizerStack(app, 'AlgorithmVisualizerStack');
