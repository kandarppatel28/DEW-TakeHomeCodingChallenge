import { Component, ElementRef, ViewChild } from '@angular/core';
import * as d3 from 'd3';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  @ViewChild('graphContainer') graphContainer: ElementRef;

  width = 960;
  height = 600;
  colors = d3.scaleOrdinal(d3.schemeCategory10);

  svg: any;
  force: any;
  path: any;
  circle: any;
  dragLine: any;

  //Mouse Event Status
  eventStatus = {
    selectedNode: null,
    selectedLink: null,
    mousedownLink: null,
    mousedownNode: null,
    mouseupNode: null,
  }

  lastNodeId = 0;

  graphCommands = "";

  nodes = [];
  links = [];

  ngAfterViewInit() {
    //Get SVG Container Width
    const rect = this.graphContainer.nativeElement.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    //Create SVG Container
    this.svg = d3.select('#graphContainer')
      .attr('oncontextmenu', 'return false;')
      .attr('width', this.width)
      .attr('height', this.height);

    this.force = d3.forceSimulation()
      .force('link', d3.forceLink().distance(150))
      .force('charge', d3.forceManyBody().strength(-500))
      .force('x', d3.forceX(this.width / 2))
      .force('y', d3.forceY(this.height / 2))
      .on('tick', () => {
        this.path.attr('d', (d: any) => {
          return `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`;
        });

        this.circle.attr('transform', (d) => `translate(${d.x},${d.y})`);
      });

    //Create Line which will be displayed when connecting nodes
    this.dragLine = this.svg.append('svg:path')
      .attr('class', 'link dragline hidden')

    //Get reference to the Paths and Circle
    this.path = this.svg.append('svg:g').selectAll('path');
    this.circle = this.svg.append('svg:g').selectAll('g');

    //Listen to different mouse events
    this.svg
      .on('mousedown', (event, d) => this.mousedown(event, d))
      .on('mousemove', (event, d) => this.mousemove(event, d))
      .on('mouseup', (event, d) => this.mouseup(event, d));

    //Listen to keyboard events
    d3.select(window)
      .on('keydown', (event) => this.keydown(event))
    this.restart();
  }

  onCommandsChange(event) {
    let commands = event.target.value;
    this.graphCommands = commands;

    if (!commands) {
      this.nodes = [];
      this.links = [];
    } else {
      commands = commands.split("\n");
      //Remove deleted nodes and links
      this.nodes = this.nodes.filter(node => {
        const index = commands.indexOf("Node " + node.id);
        if (index == -1) {
          return false;
        } else {
          commands.splice(index, 1);
          return true;
        }
      });
      this.links = this.links.filter(link => {
        const index = commands.indexOf("Link " + link.source.id + " " + link.target.id);
        if (index == -1) {
          return false;
        } else {
          commands.splice(index, 1);
          return true;
        }
      });

      //Add new nodes and links
      for (const command of commands) {
        const commandBreakDown = command.split(" ");
        if (commandBreakDown[0] == "Node" && commandBreakDown[1]) {
          this.nodes.push({ id: commandBreakDown[1] });
          this.lastNodeId++;
        } else if (commandBreakDown[0] == "Link") {
          const source = this.nodes.find(node => String(node.id) === commandBreakDown[1]);
          const target = this.nodes.find(node => String(node.id) === commandBreakDown[2]);
          if (source && target) {
            this.links.push({ source, target });
          }
        }
      }
    }
    this.restart();
  }

  resetMouseVars() {
    this.eventStatus.mousedownNode = null;
    this.eventStatus.mouseupNode = null;
    this.eventStatus.mousedownLink = null;
  }

  restart() {

    //Set Path data
    this.path = this.path.data(this.links);

    //Update Selected Link	
    this.path.classed('selected', (d) => d === this.eventStatus.selectedLink)

    //Remove Old Link
    this.path.exit().remove();

    //Add new links
    this.path = this.path.enter().append('svg:path')
      .attr('class', 'link')
      .classed('selected', (d) => d === this.eventStatus.selectedLink)
      .on('mousedown', (event, d) => {
        //Select/Unselect Link
        this.eventStatus.mousedownLink = d;
        this.eventStatus.selectedLink = (this.eventStatus.mousedownLink === this.eventStatus.selectedLink) ? null : this.eventStatus.mousedownLink;
        this.eventStatus.selectedNode = null;
        this.restart();
      })
      .merge(this.path);


    //Set Node data
    this.circle = this.circle.data(this.nodes, (d) => d.id);

    //Update Selected Node	
    this.circle.selectAll('circle')
      .style('fill', (d) => (d === this.eventStatus.selectedNode) ? d3.rgb(this.colors(d.id)).brighter().toString() : this.colors(d.id));

    //Remove Old Node
    this.circle.exit().remove();

    //Add New Nodes
    const g = this.circle.enter().append('svg:g');

    g.append('svg:circle')
      .attr('class', 'node')
      .attr('r', 18)
      .style('fill', (d) => (d === this.eventStatus.selectedNode) ? d3.rgb(this.colors(d.id)).brighter().toString() : this.colors(d.id))
      .style('stroke', (d) => d3.rgb(this.colors(d.id)).darker().toString())
      .on('mousedown', (event, d) => {

        //Select/Unselect Node
        this.eventStatus.mousedownNode = d;
        this.eventStatus.selectedNode = (this.eventStatus.mousedownNode === this.eventStatus.selectedNode) ? null : this.eventStatus.mousedownNode;
        this.eventStatus.selectedLink = null;

        //Change position of the drag line
        this.dragLine
          .classed('hidden', false)
          .attr('d', `M${this.eventStatus.mousedownNode.x},${this.eventStatus.mousedownNode.y}L${this.eventStatus.mousedownNode.x},${this.eventStatus.mousedownNode.y}`);

        this.restart();
      })
      .on('mouseup', (event, d: any) => {
        if (!this.eventStatus.mousedownNode) return;

        //Hide the drag line
        this.dragLine
          .classed('hidden', true)
          .style('marker-end', '');

        this.eventStatus.mouseupNode = d;
        if (this.eventStatus.mouseupNode === this.eventStatus.mousedownNode) {
          this.resetMouseVars();
          return;
        }

        const source = this.eventStatus.mousedownNode;
        const target = this.eventStatus.mouseupNode;

        //Check if link already exists
        const link = this.links.find((l) => (l.source === source && l.target === target) || (l.target === source && l.source === target));
        if (!link) {
          this.links.push({ source, target });
          this.graphCommands += (this.graphCommands ? "\n" : "") + "Link " + source.id + " " + target.id;
        }

        //Select the link if it exits
        this.eventStatus.selectedLink = link;
        this.eventStatus.selectedNode = null;
        this.restart();
      });

    //Show node Text
    g.append('svg:text')
      .attr('x', 0)
      .attr('y', 5)
      .attr('class', 'id')
      .text((d) => d.id);

    this.circle = g.merge(this.circle);

    this.force
      .nodes(this.nodes)
      .force('link').links(this.links);

    this.force.alphaTarget(0.8).restart();
  }

  mousedown(event: any, d: any) {
    this.svg.classed('active', true);

    if (this.eventStatus.mousedownNode || this.eventStatus.mousedownLink)
      return;

    //Insert New Node
    const point = d3.pointer(event);
    const node = { id: ++this.lastNodeId, x: point[0], y: point[1] };
    this.nodes.push(node);
    this.graphCommands += (this.graphCommands ? "\n" : "") + "Node " + node.id;

    this.restart();
  }

  mousemove(event: any, d: any) {
    if (!this.eventStatus.mousedownNode) return;

    //Update Drag Line
    this.dragLine.attr('d', `M${this.eventStatus.mousedownNode.x},${this.eventStatus.mousedownNode.y}L${d3.pointer(event)[0]},${d3.pointer(event)[1]}`);

    this.restart();
  }

  mouseup(event: any, d: any) {
    if (this.eventStatus.mousedownNode) {
      //Hide Drag Line
      this.dragLine
        .classed('hidden', true);
    }

    this.svg.classed('active', false);

    this.resetMouseVars();
  }

  keydown(event: any) {
    //Return if textarea is focused
    if (document.querySelector('#graphCommands') === document.activeElement) {
      return;
    }

    //Return If there is no selected Node or Link
    if (!this.eventStatus.selectedNode && !this.eventStatus.selectedLink)
      return;

    switch (event.keyCode) {
      case 8: // backspace
      case 46: // delete
        let commands = this.graphCommands.split("\n");
        if (this.eventStatus.selectedNode) {
          this.nodes.splice(this.nodes.indexOf(this.eventStatus.selectedNode), 1);

          //Remove node and connected links from command
          commands = commands.filter(command => command.split(" ").slice(1).indexOf(String(this.eventStatus.selectedNode.id)) === -1);

          //Remove all connected links
          this.links = this.links.filter((l) => l.source !== this.eventStatus.selectedNode && l.target !== this.eventStatus.selectedNode);
        } else if (this.eventStatus.selectedLink) {
          //Remove command
          commands = commands.filter(command => command !== "Link " + this.eventStatus.selectedLink.source.id + " " + this.eventStatus.selectedLink.target.id);
          //Remove link
          this.links.splice(this.links.indexOf(this.eventStatus.selectedLink), 1);
        }
        this.graphCommands = commands.join("\n");
        this.eventStatus.selectedLink = null;
        this.eventStatus.selectedNode = null;
        this.restart();
        break;
    }
  }
}
