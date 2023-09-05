'use strict'


import{createVersionFromString} from './version.js';

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
    /** @type {string} */ this.toothPath_ = toothPath;
    /** @type {Version} */ this.version_ = version;
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
  const jsonObject = JSON.parse(jsonString);

  // Check if the JSON object is valid.
  if (typeof jsonObject !== 'object' || jsonObject === null) {
    throw new Error('The JSON object is not valid.');
  }

  // Create the ToothMetadata object.
  switch (jsonObject.format_version) {
    case 1:
      return createToothMetadataFromJsonV1(jsonObject);

    case 2:
      throw new Error('The tooth.json format version 2 is not supported yet.');

    default:
      throw new Error('The tooth.json format version is not valid.');
  }
}

function createToothMetadataFromJsonV1(jsonObject) {
  // TODO: Validate the JSON object with a JSON schema.

  const dependencies = {};
  for (const dependency in jsonObject.dependencies) {
    dependencies[dependency] = jsonObject.dependencies[dependency].toString();
  }

  // Create the ToothMetadata object.
  const toothMetadata = new ToothMetadata(
      jsonObject.tooth, createVersionFromString(jsonObject.version),
      jsonObject.information.name, jsonObject.information.description,
      jsonObject.information.author, jsonObject.information.tags || [],
      dependencies);

  return toothMetadata;
}
