'use strict'

import Ajv from 'ajv';
import JSON_SCHEMA_V1 from '../schemas/metadata.v1.schema.js';
import JSON_SCHEMA_V2 from '../schemas/metadata.v2.schema.js';
import {createVersionFromString} from './version.js';

/**
 * A ToothMetadata object represents the metadata of a tooth.
 */
export class ToothMetadata {
  /**
   * @param {string} toothPath The tooth path.
   * @param {Version} version The version.
   * @param {string} name The name.
   * @param {string} description The description.
   * @param {string} author The author.
   * @param {string[]} tags The tags.
   * @param {Object.<string, string>} dependencies The dependencies.
   */
  constructor(
      toothPath, version, name, description, author, tags, dependencies) {
    /** @type {string} */ this.toothPath_ = toothPath.toLowerCase();
    /** @type {import('./version.js').Version} */ this.version_ = version;
    /** @type {string} */ this.name_ = name;
    /** @type {string} */ this.description_ = description;
    /** @type {string} */ this.author_ = author;
    /** @type {string[]} */ this.tags_ = tags;
    /** @type {Object<string, string>} */ this.dependencies_ = dependencies;
  }

  /**
   * Gets the tooth path.
   * @return {string} The tooth path.
   */
  getToothPath() {
    return this.toothPath_;
  }

  /**
   * Gets the version.
   * @return {Version} The version.
   */
  getVersion() {
    return this.version_;
  }

  /**
   * Gets the name.
   * @return {string} The name.
   */
  getName() {
    return this.name_;
  }

  /**
   * Gets the description.
   * @return {string} The description.
   */
  getDescription() {
    return this.description_;
  }

  /**
   * Gets the author.
   * @return {string} The author.
   */
  getAuthor() {
    return this.author_;
  }

  /**
   * Gets the tags.
   * @return {string[]} The tags.
   */
  getTags() {
    return this.tags_;
  }

  /**
   * Gets the dependencies.
   * @return {Object.<string, string>} The dependencies.
   */
  getDependencies() {
    return this.dependencies_;
  }
}

/**
 * Creates a ToothMetadata object from a JSON string.
 * @param {string} jsonString The JSON string.
 * @returns {ToothMetadata} The ToothMetadata object.
 */
export function createToothMetadataFromJsonString(jsonString) {
  const JSON_SCHEMA = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    anyOf: [JSON_SCHEMA_V1, JSON_SCHEMA_V2],
  };

  const jsonObject = JSON.parse(jsonString);

  if (!((new Ajv()).compile(JSON_SCHEMA))(jsonObject)) {
    throw new Error('The tooth.json is not valid.');
  }

  // Create the ToothMetadata object.
  switch (jsonObject.format_version) {
    case 1:
      return createToothMetadataFromJsonV1(jsonObject);

    case 2:
      return createToothMetadataFromJsonV2(jsonObject);

    default:
      // This should never happen.
  }
}

/**
 * Creates a ToothMetadata object from a JSON object of format version 1.
 * @param {Object} jsonObject The JSON object.
 * @returns {ToothMetadata} The ToothMetadata object.
 */
function createToothMetadataFromJsonV1(jsonObject) {
  const dependencies = {};
  for (const dependency in jsonObject.dependencies) {
    dependencies[dependency] = jsonObject.dependencies[dependency].toString();
  }

  // Create the ToothMetadata object.
  const toothMetadata = new ToothMetadata(
      jsonObject.tooth, createVersionFromString(jsonObject.version),
      jsonObject.information.name || '',
      jsonObject.information.description || '',
      jsonObject.information.author || '', jsonObject.information.tags || [],
      dependencies);

  return toothMetadata;
}

/**
 * Creates a ToothMetadata object from a JSON object of format version 2.
 * @param {Object} jsonObject The JSON object.
 * @returns {ToothMetadata} The ToothMetadata object.
 */
function createToothMetadataFromJsonV2(jsonObject) {
  const toothMetadata = new ToothMetadata(
      jsonObject.tooth, createVersionFromString(jsonObject.version),
      jsonObject.info.name, jsonObject.info.description, jsonObject.info.author,
      jsonObject.info.tags || [], jsonObject.dependencies);

  return toothMetadata;
}
